mod commands;

use commands::{open_file, open_file_dialog, save_file, save_file_as_dialog};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_file,
            open_file_dialog,
            save_file,
            save_file_as_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
