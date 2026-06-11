//! Gaussian Mixture Model for GrabCut color modelling.
//!
//! Each of the foreground / background models is a mixture of K full-covariance
//! 3D Gaussians (over RGB). This mirrors the model described in
//! Rother, Kolmogorov & Blake, "GrabCut" (SIGGRAPH 2004).

use nalgebra::{Matrix3, Vector3};

pub const K: usize = 5; // number of mixture components per model

#[derive(Clone)]
struct Component {
    weight: f64,
    mean: Vector3<f64>,
    cov: Matrix3<f64>,
    cov_inv: Matrix3<f64>,
    cov_det: f64,
    // accumulators used while fitting
    sum: Vector3<f64>,
    prod: Matrix3<f64>,
    count: usize,
}

impl Component {
    fn new() -> Self {
        Component {
            weight: 0.0,
            mean: Vector3::zeros(),
            cov: Matrix3::zeros(),
            cov_inv: Matrix3::zeros(),
            cov_det: 0.0,
            sum: Vector3::zeros(),
            prod: Matrix3::zeros(),
            count: 0,
        }
    }

    fn clear(&mut self) {
        self.sum = Vector3::zeros();
        self.prod = Matrix3::zeros();
        self.count = 0;
    }

    fn add_sample(&mut self, c: &Vector3<f64>) {
        self.sum += c;
        self.prod += c * c.transpose();
        self.count += 1;
    }
}

#[derive(Clone)]
pub struct Gmm {
    comps: Vec<Component>,
    total: usize,
}

impl Gmm {
    pub fn new() -> Self {
        Gmm {
            comps: (0..K).map(|_| Component::new()).collect(),
            total: 0,
        }
    }

    /// Probability density that color `c` belongs to component `ci`.
    fn comp_pdf(&self, ci: usize, c: &Vector3<f64>) -> f64 {
        let comp = &self.comps[ci];
        if comp.weight <= 0.0 || comp.cov_det <= 0.0 {
            return 0.0;
        }
        let diff = c - comp.mean;
        let m = (diff.transpose() * comp.cov_inv * diff)[(0, 0)];
        let norm = 1.0 / ((2.0 * std::f64::consts::PI).powf(1.5) * comp.cov_det.sqrt());
        norm * (-0.5 * m).exp()
    }

    /// Total probability that color `c` is drawn from this mixture.
    pub fn prob(&self, c: &Vector3<f64>) -> f64 {
        let mut p = 0.0;
        for ci in 0..K {
            p += self.comps[ci].weight * self.comp_pdf(ci, c);
        }
        p.max(1e-12)
    }

    /// Index of the most likely component for a given color.
    pub fn which_component(&self, c: &Vector3<f64>) -> usize {
        let mut best = 0usize;
        let mut best_p = -1.0;
        for ci in 0..K {
            let p = self.comp_pdf(ci, c);
            if p > best_p {
                best_p = p;
                best = ci;
            }
        }
        best
    }

    pub fn begin_learning(&mut self) {
        for comp in &mut self.comps {
            comp.clear();
        }
        self.total = 0;
    }

    pub fn add_sample(&mut self, ci: usize, c: &Vector3<f64>) {
        self.comps[ci].add_sample(c);
        self.total += 1;
    }

    /// Finalize means, covariances, and weights from accumulated samples.
    pub fn end_learning(&mut self) {
        let variance_eps = 0.01; // regularization to keep covariances invertible
        for comp in &mut self.comps {
            if comp.count == 0 {
                comp.weight = 0.0;
                continue;
            }
            let n = comp.count as f64;
            comp.weight = n / self.total.max(1) as f64;
            comp.mean = comp.sum / n;
            let mut cov = comp.prod / n - comp.mean * comp.mean.transpose();
            // regularize the diagonal
            cov[(0, 0)] += variance_eps;
            cov[(1, 1)] += variance_eps;
            cov[(2, 2)] += variance_eps;
            comp.cov = cov;
            comp.cov_det = cov.determinant();
            comp.cov_inv = cov
                .try_inverse()
                .unwrap_or_else(Matrix3::identity);
        }
    }
}

impl Default for Gmm {
    fn default() -> Self {
        Self::new()
    }
}
