//! GrabCut interactive foreground extraction.
//!
//! Algorithm reference: C. Rother, V. Kolmogorov, A. Blake,
//! "GrabCut: Interactive Foreground Extraction using Iterated Graph Cuts",
//! ACM SIGGRAPH 2004. Implemented independently here.

use crate::gmm::Gmm;
use crate::maxflow::MaxFlow;
use nalgebra::Vector3;

/// Per-pixel mask state.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Trimap {
    /// Definitely background (hard constraint).
    BgFixed,
    /// Definitely foreground (hard constraint).
    FgFixed,
    /// Probably background (free to change).
    BgMaybe,
    /// Probably foreground (free to change).
    FgMaybe,
}

impl Trimap {
    pub fn is_foreground(self) -> bool {
        matches!(self, Trimap::FgFixed | Trimap::FgMaybe)
    }
}

pub struct GrabCut {
    width: usize,
    height: usize,
    colors: Vec<Vector3<f64>>, // RGB in 0..255
    pub mask: Vec<Trimap>,
    bg_gmm: Gmm,
    fg_gmm: Gmm,
    comp_idx: Vec<usize>,
    // smoothness weights
    left_w: Vec<f64>,
    upleft_w: Vec<f64>,
    up_w: Vec<f64>,
    upright_w: Vec<f64>,
    gamma: f64,
}

impl GrabCut {
    /// `rgb` is row-major RGB, 3 bytes per pixel.
    pub fn new(width: usize, height: usize, rgb: &[u8]) -> Self {
        assert_eq!(rgb.len(), width * height * 3);
        let colors: Vec<Vector3<f64>> = (0..width * height)
            .map(|i| {
                Vector3::new(
                    rgb[i * 3] as f64,
                    rgb[i * 3 + 1] as f64,
                    rgb[i * 3 + 2] as f64,
                )
            })
            .collect();

        let gamma = 50.0;
        let mut gc = GrabCut {
            width,
            height,
            colors,
            mask: vec![Trimap::BgFixed; width * height],
            bg_gmm: Gmm::new(),
            fg_gmm: Gmm::new(),
            comp_idx: vec![0; width * height],
            left_w: vec![0.0; width * height],
            upleft_w: vec![0.0; width * height],
            up_w: vec![0.0; width * height],
            upright_w: vec![0.0; width * height],
            gamma,
        };
        gc.compute_smoothness();
        gc
    }

    fn idx(&self, x: usize, y: usize) -> usize {
        y * self.width + x
    }

    /// Compute neighbour weights using beta from the image contrast (Eq. in paper).
    fn compute_smoothness(&mut self) {
        let (w, h) = (self.width, self.height);
        // estimate beta = 1 / (2 * <||c_i - c_j||^2>)
        let mut total = 0.0;
        let mut count = 0usize;
        for y in 0..h {
            for x in 0..w {
                let c = self.colors[self.idx(x, y)];
                if x > 0 {
                    let d = c - self.colors[self.idx(x - 1, y)];
                    total += d.dot(&d);
                    count += 1;
                }
                if y > 0 {
                    let d = c - self.colors[self.idx(x, y - 1)];
                    total += d.dot(&d);
                    count += 1;
                }
                if x > 0 && y > 0 {
                    let d = c - self.colors[self.idx(x - 1, y - 1)];
                    total += d.dot(&d);
                    count += 1;
                }
                if x < w - 1 && y > 0 {
                    let d = c - self.colors[self.idx(x + 1, y - 1)];
                    total += d.dot(&d);
                    count += 1;
                }
            }
        }
        let beta = if total <= 0.0 {
            0.0
        } else {
            1.0 / (2.0 * total / count as f64)
        };
        let diag = self.gamma / (2.0f64).sqrt();
        for y in 0..h {
            for x in 0..w {
                let i = self.idx(x, y);
                let c = self.colors[i];
                if x > 0 {
                    let d = c - self.colors[self.idx(x - 1, y)];
                    self.left_w[i] = self.gamma * (-beta * d.dot(&d)).exp();
                }
                if x > 0 && y > 0 {
                    let d = c - self.colors[self.idx(x - 1, y - 1)];
                    self.upleft_w[i] = diag * (-beta * d.dot(&d)).exp();
                }
                if y > 0 {
                    let d = c - self.colors[self.idx(x, y - 1)];
                    self.up_w[i] = self.gamma * (-beta * d.dot(&d)).exp();
                }
                if x < w - 1 && y > 0 {
                    let d = c - self.colors[self.idx(x + 1, y - 1)];
                    self.upright_w[i] = diag * (-beta * d.dot(&d)).exp();
                }
            }
        }
    }

    /// Initialize the trimap from a bounding rectangle: everything inside is
    /// "probably foreground", everything outside is "definitely background".
    pub fn init_with_rect(&mut self, rx: usize, ry: usize, rw: usize, rh: usize) {
        for y in 0..self.height {
            for x in 0..self.width {
                let i = self.idx(x, y);
                let inside = x >= rx && x < rx + rw && y >= ry && y < ry + rh;
                self.mask[i] = if inside { Trimap::FgMaybe } else { Trimap::BgFixed };
            }
        }
        self.init_gmms();
    }

    /// Apply a user brush stroke. `fg=true` marks definite foreground.
    pub fn apply_stroke(&mut self, points: &[(usize, usize)], fg: bool) {
        for &(x, y) in points {
            if x < self.width && y < self.height {
                let i = self.idx(x, y);
                self.mask[i] = if fg { Trimap::FgFixed } else { Trimap::BgFixed };
            }
        }
    }

    /// Re-seed the colour models from the current `mask`. Required after
    /// writing the trimap directly (e.g. via the WASM bindings) instead of
    /// going through `init_with_rect`; `run` assumes the GMMs were seeded.
    pub fn reinit_models(&mut self) {
        self.init_gmms();
    }

    fn init_gmms(&mut self) {
        // simple k-means-free init: assign by luminance buckets, then learn.
        // Collect fg/bg pixels.
        let mut bg_samples = Vec::new();
        let mut fg_samples = Vec::new();
        for i in 0..self.colors.len() {
            if self.mask[i].is_foreground() {
                fg_samples.push(i);
            } else {
                bg_samples.push(i);
            }
        }
        self.assign_initial_components(&bg_samples, false);
        self.assign_initial_components(&fg_samples, true);
        self.learn_gmms();
    }

    // crude but effective initial clustering by splitting on dominant channel
    fn assign_initial_components(&mut self, pixels: &[usize], _fg: bool) {
        for (n, &i) in pixels.iter().enumerate() {
            self.comp_idx[i] = n % crate::gmm::K;
        }
    }

    fn learn_gmms(&mut self) {
        self.bg_gmm.begin_learning();
        self.fg_gmm.begin_learning();
        for i in 0..self.colors.len() {
            let c = self.colors[i];
            let ci = self.comp_idx[i];
            if self.mask[i].is_foreground() {
                self.fg_gmm.add_sample(ci, &c);
            } else {
                self.bg_gmm.add_sample(ci, &c);
            }
        }
        self.bg_gmm.end_learning();
        self.fg_gmm.end_learning();
    }

    fn assign_components(&mut self) {
        for i in 0..self.colors.len() {
            let c = self.colors[i];
            self.comp_idx[i] = if self.mask[i].is_foreground() {
                self.fg_gmm.which_component(&c)
            } else {
                self.bg_gmm.which_component(&c)
            };
        }
    }

    fn build_and_cut(&mut self) {
        let n = self.colors.len();
        let max_w = self.gamma * 9.0 + 1.0; // hard-constraint terminal weight
        let mut mf = MaxFlow::new(n, n * 4);

        for y in 0..self.height {
            for x in 0..self.width {
                let i = self.idx(x, y);
                let c = self.colors[i];
                // data term (terminal capacities)
                let (to_src, to_sink) = match self.mask[i] {
                    Trimap::FgFixed => (max_w, 0.0),
                    Trimap::BgFixed => (0.0, max_w),
                    _ => {
                        // prob() es una *densidad* y puede superar 1 (covarianzas
                        // pequeñas en zonas planas) → -ln() negativo. Capacidades
                        // negativas rompen el max-flow (no converge). Restar el
                        // mínimo a ambos términos del mismo píxel no cambia el
                        // min-cut y garantiza capacidades ≥ 0.
                        let fg_p = -self.fg_gmm.prob(&c).ln();
                        let bg_p = -self.bg_gmm.prob(&c).ln();
                        let m = fg_p.min(bg_p);
                        // source = foreground link weight = bg cost; sink = fg cost
                        (bg_p - m, fg_p - m)
                    }
                };
                mf.add_terminal(i, to_src, to_sink);

                // smoothness (neighbour) edges
                if x > 0 {
                    let w = self.left_w[i];
                    mf.add_edge(i, self.idx(x - 1, y), w, w);
                }
                if x > 0 && y > 0 {
                    let w = self.upleft_w[i];
                    mf.add_edge(i, self.idx(x - 1, y - 1), w, w);
                }
                if y > 0 {
                    let w = self.up_w[i];
                    mf.add_edge(i, self.idx(x, y - 1), w, w);
                }
                if x < self.width - 1 && y > 0 {
                    let w = self.upright_w[i];
                    mf.add_edge(i, self.idx(x + 1, y - 1), w, w);
                }
            }
        }

        mf.compute();

        for i in 0..n {
            // hard constraints stay fixed
            match self.mask[i] {
                Trimap::FgFixed | Trimap::BgFixed => {}
                _ => {
                    self.mask[i] = if mf.is_source(i) {
                        Trimap::FgMaybe
                    } else {
                        Trimap::BgMaybe
                    };
                }
            }
        }
    }

    /// Run `iters` rounds of (assign components → learn GMMs → graph cut).
    pub fn run(&mut self, iters: usize) {
        for _ in 0..iters {
            self.assign_components();
            self.learn_gmms();
            self.build_and_cut();
        }
    }

    /// Produce an RGBA buffer: foreground kept, background made transparent.
    pub fn to_rgba(&self, original_rgb: &[u8]) -> Vec<u8> {
        let mut out = vec![0u8; self.width * self.height * 4];
        for i in 0..self.width * self.height {
            let fg = self.mask[i].is_foreground();
            out[i * 4] = original_rgb[i * 3];
            out[i * 4 + 1] = original_rgb[i * 3 + 1];
            out[i * 4 + 2] = original_rgb[i * 3 + 2];
            out[i * 4 + 3] = if fg { 255 } else { 0 };
        }
        out
    }

    /// Produce a binary alpha mask (255 = foreground).
    pub fn alpha_mask(&self) -> Vec<u8> {
        self.mask
            .iter()
            .map(|m| if m.is_foreground() { 255 } else { 0 })
            .collect()
    }

    pub fn width(&self) -> usize {
        self.width
    }
    pub fn height(&self) -> usize {
        self.height
    }
}
