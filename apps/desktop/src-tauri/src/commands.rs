use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use tempfile::{Builder, NamedTempFile};

use crate::recent_files;

#[derive(Debug, Serialize, Clone)]
pub struct FileData {
    pub path: String,
    pub content: String,
    pub filename: String,
}

#[derive(Default)]
pub struct FileAccessState {
    current_path: Mutex<Option<String>>,
    pending_path: Mutex<Option<String>>,
}

impl FileAccessState {
    fn current_path(&self) -> Option<String> {
        self.current_path.lock().unwrap().clone()
    }

    fn set_current_path(&self, path: Option<String>) {
        *self.current_path.lock().unwrap() = path;
    }

    fn queue_pending_path(&self, path: String) {
        *self.pending_path.lock().unwrap() = Some(path);
    }

    fn accept_pending_path(&self, expected_path: &str) -> Result<(), String> {
        let accepted = {
            let mut pending = self.pending_path.lock().unwrap();
            match pending.as_ref() {
                Some(path) if path == expected_path => pending.take(),
                Some(_) => {
                    return Err("Pending file does not match expected path".into());
                }
                None => return Err("No pending file to accept".into()),
            }
        };

        if let Some(path) = accepted {
            self.set_current_path(Some(path));
            Ok(())
        } else {
            Err("No pending file to accept".into())
        }
    }
}

/// Validate that a path is absolute and read its contents.
fn validate_and_read(path: &str) -> Result<FileData, String> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err("Path must be absolute".into());
    }
    let content = fs::read_to_string(p).map_err(|e| format!("Failed to read file: {e}"))?;
    let filename = p
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    Ok(FileData {
        path: path.to_string(),
        content,
        filename,
    })
}

/// Atomic write: write to a temp file in the same directory, then rename.
fn create_save_tempfile(parent: &Path) -> Result<NamedTempFile, String> {
    Builder::new()
        .prefix(".mdedit-save-")
        .tempfile_in(parent)
        .map_err(|e| format!("Failed to create temp file: {e}"))
}

/// Atomic write: write to a unique temp file in the same directory, then persist it.
fn atomic_write(path: &str, content: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err("Path must be absolute".into());
    }
    let parent = p
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;
    let mut temp = create_save_tempfile(parent)?;

    temp.as_file_mut().write_all(content.as_bytes()).map_err(|e| {
        format!("Failed to write temp file: {e}")
    })?;

    temp.persist(p).map_err(|e| {
        format!("Failed to rename temp file: {e}")
    })?;

    Ok(())
}

fn set_current_path(access: &FileAccessState, path: &Path) {
    access.set_current_path(Some(path.to_string_lossy().to_string()));
}

pub fn queue_external_open(access: &FileAccessState, path: &Path) -> Result<FileData, String> {
    let path_str = path.to_string_lossy().to_string();
    let data = validate_and_read(&path_str)?;
    access.queue_pending_path(path_str);
    Ok(data)
}

/// Convert a FilePath from the dialog plugin into a PathBuf.
fn file_path_to_pathbuf(fp: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
    fp.into_path()
        .map_err(|e| format!("Failed to convert file path: {e}"))
}

#[tauri::command]
pub async fn open_file_dialog(
    app: AppHandle,
    access: State<'_, FileAccessState>,
) -> Result<Option<FileData>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    match file_path {
        Some(fp) => {
            let path_buf = file_path_to_pathbuf(fp)?;
            let data = validate_and_read(&path_buf.to_string_lossy())?;
            set_current_path(&access, &path_buf);
            Ok(Some(data))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn save_current_file(
    access: State<'_, FileAccessState>,
    content: String,
) -> Result<(), String> {
    let path = access
        .current_path()
        .ok_or_else(|| "No current file path".to_string())?;
    atomic_write(&path, &content)
}

#[tauri::command]
pub async fn save_file_as_dialog(
    app: AppHandle,
    access: State<'_, FileAccessState>,
    content: String,
) -> Result<Option<FileData>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_save_file();

    match file_path {
        Some(fp) => {
            let path_buf = file_path_to_pathbuf(fp)?;
            let path_str = path_buf.to_string_lossy().to_string();
            atomic_write(&path_str, &content)?;
            set_current_path(&access, &path_buf);
            let filename = path_buf
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            Ok(Some(FileData {
                path: path_str,
                content,
                filename,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn accept_pending_file(
    access: State<'_, FileAccessState>,
    path: String,
) -> Result<(), String> {
    access.accept_pending_path(&path)
}

#[tauri::command]
pub fn clear_current_file(access: State<'_, FileAccessState>) {
    access.set_current_path(None);
}

#[tauri::command]
pub async fn get_recent_files(app: AppHandle) -> Vec<String> {
    recent_files::load_recent(&app)
}

#[tauri::command]
pub async fn add_to_recent(app: AppHandle, path: String) {
    recent_files::add_recent(&app, &path);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_open_file_reads_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "# Hello\n\nWorld").unwrap();

        let result = validate_and_read(&file_path.to_string_lossy()).unwrap();
        assert_eq!(result.content, "# Hello\n\nWorld");
        assert_eq!(result.filename, "test.md");
        assert_eq!(result.path, file_path.to_string_lossy().to_string());
    }

    #[test]
    fn test_save_file_atomic_writes_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("output.md");

        atomic_write(&file_path.to_string_lossy(), "# Saved content").unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "# Saved content");
    }

    #[test]
    fn test_save_leaves_no_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("output.md");

        atomic_write(&file_path.to_string_lossy(), "content").unwrap();

        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].file_name().to_string_lossy(), "output.md");
    }

    #[test]
    fn test_atomic_write_uses_unique_temp_files() {
        let dir = tempfile::tempdir().unwrap();

        let temp_one = create_save_tempfile(dir.path()).unwrap();
        let temp_two = create_save_tempfile(dir.path()).unwrap();

        assert_ne!(temp_one.path(), temp_two.path());
        assert_eq!(temp_one.path().parent(), Some(dir.path()));
        assert_eq!(temp_two.path().parent(), Some(dir.path()));
    }

    #[test]
    fn test_atomic_write_failure_cleans_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let target_dir = dir.path().join("target");
        fs::create_dir(&target_dir).unwrap();

        let result = atomic_write(&target_dir.to_string_lossy(), "content");
        assert!(result.is_err());

        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(".mdedit-save-"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn test_open_nonexistent_file_returns_error() {
        let result = validate_and_read("/tmp/nonexistent_file_mdedit_test_12345.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn test_open_relative_path_rejected() {
        let result = validate_and_read("relative/path.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path must be absolute"));
    }

    #[test]
    fn test_save_relative_path_rejected() {
        let result = atomic_write("relative/path.md", "content");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path must be absolute"));
    }

    #[test]
    fn test_open_binary_file_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("binary.md");
        fs::write(&file_path, b"\xff\xfe invalid utf8").unwrap();
        let result = validate_and_read(&file_path.to_string_lossy());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn test_path_traversal_rejected() {
        // Relative path with .. is rejected (not absolute)
        let result = validate_and_read("../etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path must be absolute"));

        let result = atomic_write("../etc/evil.md", "content");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path must be absolute"));
    }

    #[test]
    fn test_accept_pending_path_promotes_it_to_current() {
        let access = FileAccessState::default();
        access.queue_pending_path("/tmp/example.md".to_string());

        access.accept_pending_path("/tmp/example.md").unwrap();

        assert_eq!(access.current_path(), Some("/tmp/example.md".to_string()));
    }

    #[test]
    fn test_accept_pending_path_errors_when_empty() {
        let access = FileAccessState::default();
        assert!(access.accept_pending_path("/tmp/example.md").is_err());
    }

    #[test]
    fn test_accept_pending_path_rejects_mismatch_without_clearing() {
        let access = FileAccessState::default();
        access.queue_pending_path("/tmp/expected.md".to_string());

        let result = access.accept_pending_path("/tmp/other.md");

        assert!(result.is_err());
        assert_eq!(access.current_path(), None);
        assert!(access.accept_pending_path("/tmp/expected.md").is_ok());
    }
}
