mod commands;
mod menu;
mod recent_files;

use commands::{
    accept_pending_file, add_to_recent, clear_current_file, export_html_dialog, get_log_path,
    get_recent_files, get_startup_file, log_error, open_file_dialog, queue_external_open,
    save_current_file, save_file_as_dialog, save_pasted_image, FileAccessState,
};
use tauri::{DragDropEvent, Emitter, Manager, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FileAccessState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            menu::setup_menu(app)?;

            // Handle files opened via OS file association (double-click in Finder).
            // The deep-link plugin delivers file:// URLs through on_open_url.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let access = handle.state::<FileAccessState>();
                for url in event.urls() {
                    if url.scheme() == "file" {
                        if let Ok(path) = url.to_file_path() {
                            match queue_external_open(&access, &path) {
                                Ok(data) => {
                                    let _ = handle.emit("open-file", data);
                                }
                                Err(err) => eprintln!("Failed to queue deep-link open: {err}"),
                            }
                        }
                    }
                }
            });

            // Check if the app was launched with a file argument (cold start).
            // Store the file data for the frontend to pick up via get_startup_file
            // instead of emitting an event (the webview isn't ready yet).
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                let handle = app.handle().clone();
                let access = handle.state::<FileAccessState>();
                for url in urls {
                    if url.scheme() == "file" {
                        if let Ok(path) = url.to_file_path() {
                            match queue_external_open(&access, &path) {
                                Ok(data) => {
                                    access.store_startup_file(data);
                                }
                                Err(err) => eprintln!("Failed to queue startup open: {err}"),
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                if let Some(path) = paths
                    .iter()
                    .find(|path| path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| {
                        matches!(
                            ext.to_ascii_lowercase().as_str(),
                            "md" | "markdown" | "mdx"
                        )
                    }))
                {
                    let access = window.state::<FileAccessState>();
                    match queue_external_open(&access, path) {
                        Ok(data) => {
                            let _ = window.emit("open-file", data);
                        }
                        Err(err) => eprintln!("Failed to queue dropped file: {err}"),
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            save_current_file,
            save_file_as_dialog,
            export_html_dialog,
            accept_pending_file,
            clear_current_file,
            get_startup_file,
            get_recent_files,
            add_to_recent,
            save_pasted_image,
            log_error,
            get_log_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
