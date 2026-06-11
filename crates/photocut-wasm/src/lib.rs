//! Bindings WASM del motor GrabCut (photocut-core) para la web.
//!
//! Diseño *stateless por llamada*: el frontend (CutoutSession en JS) es el
//! dueño del trimap y del historial undo/redo; aquí solo se recibe el trimap
//! completo, se corre GrabCut y se devuelve la máscara. Así el WASM nunca
//! diverge del estado JS.
//!
//! Regenerar el paquete: `npm run build:wasm`.

use photocut_core::{GrabCut, Trimap};
use wasm_bindgen::prelude::*;

/// Codificación del trimap que llega desde JS.
const TRI_BG_FIXED: u8 = 0;
const TRI_FG_FIXED: u8 = 1;
const TRI_BG_MAYBE: u8 = 2;
const TRI_FG_MAYBE: u8 = 3;

#[wasm_bindgen]
pub struct WasmCut {
    engine: GrabCut,
}

#[wasm_bindgen]
impl WasmCut {
    /// `rgba`: buffer row-major RGBA de `width × height` (el canal alfa se ignora).
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32, rgba: &[u8]) -> Result<WasmCut, JsError> {
        let n = (width as usize) * (height as usize);
        if rgba.len() != n * 4 {
            return Err(JsError::new("rgba buffer size mismatch"));
        }
        let mut rgb = vec![0u8; n * 3];
        for i in 0..n {
            rgb[i * 3] = rgba[i * 4];
            rgb[i * 3 + 1] = rgba[i * 4 + 1];
            rgb[i * 3 + 2] = rgba[i * 4 + 2];
        }
        Ok(WasmCut {
            engine: GrabCut::new(width as usize, height as usize, &rgb),
        })
    }

    /// Corre GrabCut con el trimap dado (0=BG, 1=FG, 2=quizásBG, 3=quizásFG)
    /// y devuelve la máscara alfa binaria (255 = primer plano).
    pub fn segment(&mut self, trimap: &[u8], iters: u32) -> Result<Vec<u8>, JsError> {
        if trimap.len() != self.engine.mask.len() {
            return Err(JsError::new("trimap size mismatch"));
        }
        for (m, &v) in self.engine.mask.iter_mut().zip(trimap.iter()) {
            *m = match v {
                TRI_FG_FIXED => Trimap::FgFixed,
                TRI_BG_MAYBE => Trimap::BgMaybe,
                TRI_FG_MAYBE => Trimap::FgMaybe,
                _ => Trimap::BgFixed,
            };
        }
        debug_assert!(TRI_BG_FIXED == 0);
        // imprescindible: `run` asume GMMs sembrados (sin esto, ln(0) → pesos
        // infinitos y el max-flow no converge)
        self.engine.reinit_models();
        self.engine.run(iters.max(1) as usize);
        Ok(self.engine.alpha_mask())
    }
}
