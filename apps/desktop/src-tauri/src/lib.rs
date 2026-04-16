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
            // Single-document editor: open the first file, log any extras.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let access = handle.state::<FileAccessState>();
                let file_urls: Vec<_> = event
                    .urls()
                    .iter()
                    .filter(|url| url.scheme() == "file")
                    .filter_map(|url| url.to_file_path().ok())
                    .collect();
                if file_urls.len() > 1 {
                    eprintln!(
                        "Multiple files requested; opening first, skipping {} others",
                        file_urls.len() - 1
                    );
                }
                if let Some(path) = file_urls.first() {
                    match queue_external_open(&access, path) {
                        Ok(data) => {
                            // Buffer for cold start (frontend drains via get_startup_file
                            // on mount). Also emit for hot opens where the listener is
                            // already attached. The two paths are mutually exclusive:
                            // cold start loses the emit (no listener yet), hot open
                            // ignores the buffer (already drained on mount).
                            access.store_startup_file(data.clone());
                            let _ = handle.emit("open-file", data);
                        }
                        Err(err) => eprintln!("Failed to queue deep-link open: {err}"),
                    }
                }
            });

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
