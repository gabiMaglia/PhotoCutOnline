//! Tauri command layer. Holds a cutout session in app state and exposes
//! commands the React frontend calls via `invoke`.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use photocut_core::{Cutout, Rect, Stroke};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// The active editing session. `None` until an image is loaded.
#[derive(Default)]
pub struct Session(pub Mutex<Option<Cutout>>);

#[derive(Deserialize)]
pub struct RectArg {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
}

#[derive(Deserialize)]
pub struct StrokeArg {
    points: Vec<(u32, u32)>,
    foreground: bool,
}

#[derive(Serialize)]
pub struct LoadResult {
    width: u32,
    height: u32,
}

fn decode_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    // Accept either a raw base64 string or a full data: URL.
    let b64 = match data_url.split_once(",") {
        Some((_, rest)) => rest,
        None => data_url,
    };
    STANDARD.decode(b64).map_err(|e| format!("base64 decode: {e}"))
}

fn encode_png(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", STANDARD.encode(bytes))
}

#[tauri::command]
pub fn load_image(data_url: String, session: State<Session>) -> Result<LoadResult, String> {
    let bytes = decode_data_url(&data_url)?;
    let cutout = Cutout::from_bytes(&bytes).map_err(|e| e.to_string())?;
    let res = LoadResult { width: cutout.width(), height: cutout.height() };
    *session.0.lock().unwrap() = Some(cutout);
    Ok(res)
}

#[tauri::command]
pub fn cut_rect(rect: RectArg, iters: usize, session: State<Session>) -> Result<String, String> {
    let mut guard = session.0.lock().unwrap();
    let cutout = guard.as_mut().ok_or("no image loaded")?;
    cutout
        .cut_with_rect(Rect { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, iters.max(1))
        .map_err(|e| e.to_string())?;
    let png = cutout.to_transparent_png().map_err(|e| e.to_string())?;
    Ok(encode_png(&png))
}

#[tauri::command]
pub fn refine(strokes: Vec<StrokeArg>, iters: usize, session: State<Session>) -> Result<String, String> {
    let mut guard = session.0.lock().unwrap();
    let cutout = guard.as_mut().ok_or("no image loaded")?;
    let conv: Vec<Stroke> = strokes
        .into_iter()
        .map(|s| Stroke { points: s.points, foreground: s.foreground })
        .collect();
    cutout.refine(&conv, iters.max(1));
    let png = cutout.to_transparent_png().map_err(|e| e.to_string())?;
    Ok(encode_png(&png))
}

#[tauri::command]
pub fn export_transparent(session: State<Session>) -> Result<String, String> {
    let guard = session.0.lock().unwrap();
    let cutout = guard.as_ref().ok_or("no image loaded")?;
    let png = cutout.to_transparent_png().map_err(|e| e.to_string())?;
    Ok(encode_png(&png))
}

#[tauri::command]
pub fn export_solid(color: [u8; 4], session: State<Session>) -> Result<String, String> {
    let guard = session.0.lock().unwrap();
    let cutout = guard.as_ref().ok_or("no image loaded")?;
    let png = cutout.to_solid_background(color).map_err(|e| e.to_string())?;
    Ok(encode_png(&png))
}

#[tauri::command]
pub fn export_image_bg(bg_data_url: String, session: State<Session>) -> Result<String, String> {
    let bg = decode_data_url(&bg_data_url)?;
    let guard = session.0.lock().unwrap();
    let cutout = guard.as_ref().ok_or("no image loaded")?;
    let png = cutout.to_image_background(&bg).map_err(|e| e.to_string())?;
    Ok(encode_png(&png))
}
