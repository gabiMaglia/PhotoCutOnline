mod commands;

use commands::Session;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Session::default())
        .invoke_handler(tauri::generate_handler![
            commands::load_image,
            commands::cut_rect,
            commands::refine,
            commands::export_transparent,
            commands::export_solid,
            commands::export_image_bg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
