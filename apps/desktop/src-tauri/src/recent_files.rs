use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const MAX_RECENT: usize = 10;
const RECENT_FILE: &str = "recent_files.json";

fn get_recent_path(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join(RECENT_FILE)
}

pub fn load_recent(app: &AppHandle) -> Vec<String> {
    let path = get_recent_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

pub fn add_recent(app: &AppHandle, file_path: &str) {
    let mut recent = load_recent(app);
    recent.retain(|p| p != file_path);
    recent.insert(0, file_path.to_string());
    recent.truncate(MAX_RECENT);
    let path = get_recent_path(app);
    let data = serde_json::to_string(&recent).unwrap_or_default();
    fs::write(path, data).ok();
}
