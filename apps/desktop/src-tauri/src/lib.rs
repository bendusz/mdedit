mod commands;
mod menu;
mod recent_files;

use commands::{
    add_to_recent, get_recent_files, open_file, open_file_dialog, save_file, save_file_as_dialog,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            menu::setup_menu(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            open_file_dialog,
            save_file,
            save_file_as_dialog,
            get_recent_files,
            add_to_recent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
