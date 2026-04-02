use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Clone)]
pub struct FileData {
    pub path: String,
    pub content: String,
    pub filename: String,
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
fn atomic_write(path: &str, content: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err("Path must be absolute".into());
    }
    let parent = p
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;
    let pid = std::process::id();
    let temp_name = format!(".mdedit-save-{pid}");
    let temp_path = parent.join(&temp_name);

    fs::write(&temp_path, content).map_err(|e| {
        // Clean up temp file on write failure
        let _ = fs::remove_file(&temp_path);
        format!("Failed to write temp file: {e}")
    })?;

    fs::rename(&temp_path, p).map_err(|e| {
        // Clean up temp file on rename failure
        let _ = fs::remove_file(&temp_path);
        format!("Failed to rename temp file: {e}")
    })?;

    Ok(())
}

/// Convert a FilePath from the dialog plugin into a PathBuf.
fn file_path_to_pathbuf(fp: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
    fp.into_path()
        .map_err(|e| format!("Failed to convert file path: {e}"))
}

#[tauri::command]
pub fn open_file(path: String) -> Result<FileData, String> {
    validate_and_read(&path)
}

#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Result<Option<FileData>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    match file_path {
        Some(fp) => {
            let path_buf =
                file_path_to_pathbuf(fp)?;
            let path_str = path_buf.to_string_lossy().to_string();
            let data = validate_and_read(&path_str)?;
            Ok(Some(data))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    atomic_write(&path, &content)
}

#[tauri::command]
pub async fn save_file_as_dialog(
    app: AppHandle,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_open_file_reads_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "# Hello\n\nWorld").unwrap();

        let result = open_file(file_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(result.content, "# Hello\n\nWorld");
        assert_eq!(result.filename, "test.md");
        assert_eq!(result.path, file_path.to_string_lossy().to_string());
    }

    #[test]
    fn test_save_file_atomic_writes_content() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("output.md");

        save_file(
            file_path.to_string_lossy().to_string(),
            "# Saved content".to_string(),
        )
        .unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "# Saved content");
    }

    #[test]
    fn test_save_leaves_no_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("output.md");

        save_file(
            file_path.to_string_lossy().to_string(),
            "content".to_string(),
        )
        .unwrap();

        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].file_name().to_string_lossy(), "output.md");
    }

    #[test]
    fn test_open_nonexistent_file_returns_error() {
        let result = open_file("/tmp/nonexistent_file_mdedit_test_12345.md".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn test_open_relative_path_rejected() {
        let result = open_file("relative/path.md".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path must be absolute"));
    }

    #[test]
    fn test_save_relative_path_rejected() {
        let result = save_file("relative/path.md".to_string(), "content".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path must be absolute"));
    }
}
