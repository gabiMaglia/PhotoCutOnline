//! photocut-core: permissively-licensed interactive cutout engine.
//!
//! Public entry points are in this file. The heavy lifting lives in the
//! `grabcut`, `gmm`, and `maxflow` modules.

mod gmm;
mod grabcut;
mod maxflow;

pub use grabcut::{GrabCut, Trimap};

use image::{ImageFormat, RgbImage, RgbaImage};
use std::io::Cursor;

#[derive(thiserror::Error, Debug)]
pub enum CutError {
    #[error("image decode/encode failed: {0}")]
    Image(#[from] image::ImageError),
    #[error("invalid rectangle for image of size {w}x{h}")]
    BadRect { w: u32, h: u32 },
}

/// A rectangle in pixel coordinates.
#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

/// A user scribble: a list of points plus whether it marks foreground.
#[derive(Clone, Debug)]
pub struct Stroke {
    pub points: Vec<(u32, u32)>,
    pub foreground: bool,
}

/// Result of a cutout: the engine plus the original RGB for re-export.
pub struct Cutout {
    engine: GrabCut,
    rgb: Vec<u8>,
    width: u32,
    height: u32,
}

impl Cutout {
    /// Decode arbitrary image bytes and prepare a GrabCut engine.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CutError> {
        let img = image::load_from_memory(bytes)?.to_rgb8();
        let (width, height) = img.dimensions();
        let rgb = img.into_raw();
        let engine = GrabCut::new(width as usize, height as usize, &rgb);
        Ok(Cutout { engine, rgb, width, height })
    }

    pub fn width(&self) -> u32 {
        self.width
    }
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Initialize from a bounding rectangle and run `iters` iterations.
    pub fn cut_with_rect(&mut self, rect: Rect, iters: usize) -> Result<(), CutError> {
        if rect.x + rect.w > self.width || rect.y + rect.h > self.height || rect.w == 0 || rect.h == 0 {
            return Err(CutError::BadRect { w: self.width, h: self.height });
        }
        self.engine.init_with_rect(
            rect.x as usize,
            rect.y as usize,
            rect.w as usize,
            rect.h as usize,
        );
        self.engine.run(iters);
        Ok(())
    }

    /// Refine the current cut with foreground/background scribbles.
    pub fn refine(&mut self, strokes: &[Stroke], iters: usize) {
        for s in strokes {
            let pts: Vec<(usize, usize)> =
                s.points.iter().map(|&(x, y)| (x as usize, y as usize)).collect();
            self.engine.apply_stroke(&pts, s.foreground);
        }
        self.engine.run(iters);
    }

    /// Export the cutout as a transparent PNG (background alpha = 0).
    pub fn to_transparent_png(&self) -> Result<Vec<u8>, CutError> {
        let rgba = self.engine.to_rgba(&self.rgb);
        let img = RgbaImage::from_raw(self.width, self.height, rgba).expect("size matches");
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Png)?;
        Ok(buf.into_inner())
    }

    /// Export the cutout composited over a solid RGBA background color.
    pub fn to_solid_background(&self, color: [u8; 4]) -> Result<Vec<u8>, CutError> {
        let mask = self.engine.alpha_mask();
        let mut out = vec![0u8; (self.width * self.height) as usize * 4];
        for i in 0..(self.width * self.height) as usize {
            if mask[i] == 255 {
                out[i * 4] = self.rgb[i * 3];
                out[i * 4 + 1] = self.rgb[i * 3 + 1];
                out[i * 4 + 2] = self.rgb[i * 3 + 2];
                out[i * 4 + 3] = 255;
            } else {
                out[i * 4..i * 4 + 4].copy_from_slice(&color);
            }
        }
        let img = RgbaImage::from_raw(self.width, self.height, out).expect("size matches");
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Png)?;
        Ok(buf.into_inner())
    }

    /// Export the cutout composited over another image (resized to match).
    pub fn to_image_background(&self, bg_bytes: &[u8]) -> Result<Vec<u8>, CutError> {
        let bg = image::load_from_memory(bg_bytes)?
            .resize_exact(self.width, self.height, image::imageops::FilterType::Lanczos3)
            .to_rgb8();
        let mask = self.engine.alpha_mask();
        let mut out = vec![0u8; (self.width * self.height) as usize * 4];
        for i in 0..(self.width * self.height) as usize {
            if mask[i] == 255 {
                out[i * 4] = self.rgb[i * 3];
                out[i * 4 + 1] = self.rgb[i * 3 + 1];
                out[i * 4 + 2] = self.rgb[i * 3 + 2];
            } else {
                out[i * 4] = bg.as_raw()[i * 3];
                out[i * 4 + 1] = bg.as_raw()[i * 3 + 1];
                out[i * 4 + 2] = bg.as_raw()[i * 3 + 2];
            }
            out[i * 4 + 3] = 255;
        }
        let img = RgbaImage::from_raw(self.width, self.height, out).expect("size matches");
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Png)?;
        Ok(buf.into_inner())
    }

    /// Raw RGBA preview bytes (no encoding) for fast canvas display.
    pub fn preview_rgba(&self) -> Vec<u8> {
        self.engine.to_rgba(&self.rgb)
    }

    /// Helper to build an RgbImage of the source (for tests/tools).
    pub fn source_image(&self) -> RgbImage {
        RgbImage::from_raw(self.width, self.height, self.rgb.clone()).expect("size matches")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_png() -> Vec<u8> {
        // 40x40: red square (foreground) on blue (background)
        let (w, h) = (40u32, 40u32);
        let mut img = RgbImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let px = if x >= 10 && x < 30 && y >= 10 && y < 30 {
                    image::Rgb([220, 30, 30])
                } else {
                    image::Rgb([30, 30, 220])
                };
                img.put_pixel(x, y, px);
            }
        }
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Png).unwrap();
        buf.into_inner()
    }

    #[test]
    fn cuts_central_object() {
        let bytes = make_test_png();
        let mut c = Cutout::from_bytes(&bytes).unwrap();
        c.cut_with_rect(Rect { x: 8, y: 8, w: 24, h: 24 }, 3).unwrap();
        let png = c.to_transparent_png().unwrap();
        assert!(png.len() > 8);
        // center should be opaque, corner transparent
        let rgba = c.preview_rgba();
        let center = (20 * 40 + 20) * 4;
        let corner = 0;
        assert_eq!(rgba[center + 3], 255, "center should be foreground");
        assert_eq!(rgba[corner + 3], 0, "corner should be background");
    }

    #[test]
    fn rejects_bad_rect() {
        let bytes = make_test_png();
        let mut c = Cutout::from_bytes(&bytes).unwrap();
        let r = c.cut_with_rect(Rect { x: 0, y: 0, w: 999, h: 999 }, 1);
        assert!(r.is_err());
    }
}
