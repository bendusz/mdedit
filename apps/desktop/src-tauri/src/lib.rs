mod commands;
mod menu;
mod recent_files;

use commands::{
    add_to_recent, get_recent_files, open_file, open_file_dialog, save_file, save_file_as_dialog,
};
use tauri::Emitter;
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            menu::setup_menu(app)?;

            // Handle files opened via OS file association (double-click in Finder).
            // The deep-link plugin delivers file:// URLs through on_open_url.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    if url.scheme() == "file" {
                        if let Ok(path) = url.to_file_path() {
                            let path_str = path.to_string_lossy().to_string();
                            let _ = handle.emit("open-file", path_str);
                        }
                    }
                }
            });

            // Check if the app was launched with a file argument (cold start).
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                let handle = app.handle().clone();
                for url in urls {
                    if url.scheme() == "file" {
                        if let Ok(path) = url.to_file_path() {
                            let path_str = path.to_string_lossy().to_string();
                            let _ = handle.emit("open-file", path_str);
                        }
                    }
                }
            }

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
