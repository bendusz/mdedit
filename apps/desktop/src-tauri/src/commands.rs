use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use chrono::Utc;
use serde::Serialize;
use std::fs;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
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
    startup_file: Mutex<Option<FileData>>,
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

    pub fn store_startup_file(&self, data: FileData) {
        *self.startup_file.lock().unwrap() = Some(data);
    }

    pub fn take_startup_file(&self) -> Option<FileData> {
        self.startup_file.lock().unwrap().take()
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
pub fn get_startup_file(
    access: State<'_, FileAccessState>,
) -> Result<Option<FileData>, String> {
    let Some(data) = access.take_startup_file() else {
        return Ok(None);
    };
    // Atomically promote the pending path to current_path so there is no
    // window where another open can overwrite pending_path before the
    // frontend calls accept_pending_file.
    access.accept_pending_path(&data.path)?;
    Ok(Some(data))
}

#[tauri::command]
pub fn clear_current_file(access: State<'_, FileAccessState>) {
    access.set_current_path(None);
}

#[tauri::command]
pub async fn export_html_dialog(
    app: AppHandle,
    html_content: String,
) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("HTML", &["html", "htm"])
        .blocking_save_file();

    match file_path {
        Some(fp) => {
            let path_buf = file_path_to_pathbuf(fp)?;
            let path_str = path_buf.to_string_lossy().to_string();
            atomic_write(&path_str, &html_content)?;
            Ok(Some(path_str))
        }
        None => Ok(None),
    }
}

/// Atomic write for binary data: write to a temp file in the same directory, then rename.
fn atomic_write_bytes(path: &str, data: &[u8]) -> Result<(), String> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err("Path must be absolute".into());
    }
    let parent = p
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;
    let mut temp = create_save_tempfile(parent)?;

    temp.as_file_mut()
        .write_all(data)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;

    temp.persist(p)
        .map_err(|e| format!("Failed to rename temp file: {e}"))?;

    Ok(())
}

/// Map a MIME subtype to a file extension.
fn extension_for_mime(mime_subtype: &str) -> &str {
    match mime_subtype {
        "png" => "png",
        "jpeg" => "jpg",
        "gif" => "gif",
        "webp" => "webp",
        _ => "png",
    }
}

/// Generate a unique image filename based on the current timestamp.
fn generate_image_filename(ext: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("image-{nanos}.{ext}")
}

#[tauri::command]
pub fn save_pasted_image(
    directory: String,
    image_base64: String,
    filename: Option<String>,
    mime_subtype: Option<String>,
) -> Result<String, String> {
    let dir = Path::new(&directory);
    if !dir.is_absolute() {
        return Err("Directory path must be absolute".into());
    }
    if !dir.is_dir() {
        return Err("Directory does not exist".into());
    }

    let decoded = BASE64_STANDARD
        .decode(&image_base64)
        .map_err(|e| format!("Invalid base64 data: {e}"))?;

    if decoded.is_empty() {
        return Err("Image data is empty".into());
    }

    let ext = extension_for_mime(mime_subtype.as_deref().unwrap_or("png"));
    let name = filename.unwrap_or_else(|| generate_image_filename(ext));

    // Sanitize filename: keep only safe characters
    let safe_name: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();
    if safe_name.is_empty() {
        return Err("Invalid filename".into());
    }

    // Guard against "." / ".." — a safe filename must not be a path-special component.
    if safe_name == "." || safe_name == ".." {
        return Err("Invalid filename".into());
    }
    let file_path = dir.join(&safe_name);
    // Confirm the resolved path is directly inside the target directory (no traversal).
    if file_path.parent() != Some(dir) {
        return Err("Invalid filename".into());
    }
    let file_path_str = file_path.to_string_lossy().to_string();

    atomic_write_bytes(&file_path_str, &decoded)?;

    Ok(safe_name)
}

#[tauri::command]
pub async fn get_recent_files(app: AppHandle) -> Vec<String> {
    recent_files::load_recent(&app)
}

#[tauri::command]
pub async fn add_to_recent(app: AppHandle, path: String) {
    recent_files::add_recent(&app, &path);
}

// --- Structured error logging ---

const MAX_LOG_SIZE: u64 = 1_048_576; // 1 MB

/// Return the path to the mdedit log directory (~/.mdedit/).
fn log_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".mdedit"))
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

/// Return the path to the error log file (~/.mdedit/error.log).
fn log_file_path() -> Result<PathBuf, String> {
    Ok(log_dir()?.join("error.log"))
}

/// Format a structured log line.
fn format_log_line(category: &str, message: &str, details: Option<&str>) -> String {
    let ts = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    match details {
        Some(d) => format!("[{ts}] [{category}] {message} | {d}\n"),
        None => format!("[{ts}] [{category}] {message}\n"),
    }
}

/// Append a log line to the given log file path, creating parent dirs if needed.
/// If the log exceeds MAX_LOG_SIZE, truncate the oldest half of the lines.
fn append_log_line_to(path: &Path, line: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create log directory: {e}"))?;
    }

    // Append the new line
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("Failed to open log file: {e}"))?;

    file.write_all(line.as_bytes())
        .map_err(|e| format!("Failed to write log line: {e}"))?;

    drop(file);

    // Check size and truncate if needed
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_LOG_SIZE {
            truncate_log(path)?;
        }
    }

    Ok(())
}

/// Append a log line to the default error log (~/.mdedit/error.log).
fn append_log_line(line: &str) -> Result<(), String> {
    let path = log_file_path()?;
    append_log_line_to(&path, line)
}

/// Truncate the log file by keeping only the newest half of lines.
fn truncate_log(path: &Path) -> Result<(), String> {
    let data = fs::read(path).map_err(|e| format!("Failed to read log for truncation: {e}"))?;
    let cursor = std::io::Cursor::new(&data);
    let lines: Vec<String> = cursor
        .lines()
        .filter_map(|l| l.ok())
        .collect();

    let keep_from = lines.len() / 2;
    let kept: String = lines[keep_from..]
        .iter()
        .map(|l| format!("{l}\n"))
        .collect();

    let path_str = path.to_string_lossy();
    atomic_write(&path_str, &kept)?;
    Ok(())
}

#[tauri::command]
pub fn log_error(
    category: String,
    message: String,
    details: Option<String>,
) -> Result<(), String> {
    let line = format_log_line(&category, &message, details.as_deref());
    append_log_line(&line)
}

#[tauri::command]
pub fn get_log_path() -> Result<String, String> {
    let path = log_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create log directory: {e}"))?;
    }
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to create log file: {e}"))?;
    Ok(path.to_string_lossy().to_string())
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
    fn test_startup_file_stored_and_taken_once() {
        let access = FileAccessState::default();
        assert!(access.take_startup_file().is_none());

        access.store_startup_file(FileData {
            path: "/tmp/startup.md".to_string(),
            content: "# Hello".to_string(),
            filename: "startup.md".to_string(),
        });

        let taken = access.take_startup_file();
        assert!(taken.is_some());
        let data = taken.unwrap();
        assert_eq!(data.path, "/tmp/startup.md");
        assert_eq!(data.content, "# Hello");
        assert_eq!(data.filename, "startup.md");

        // Second take returns None
        assert!(access.take_startup_file().is_none());
    }

    #[test]
    fn test_startup_file_take_also_accepts_pending_path() {
        // Simulates the full cold-start flow: queue_external_open sets
        // pending_path, store_startup_file stores data. Taking the startup
        // file should atomically promote pending_path to current_path.
        let access = FileAccessState::default();
        access.queue_pending_path("/tmp/startup.md".to_string());
        access.store_startup_file(FileData {
            path: "/tmp/startup.md".to_string(),
            content: "# Cold start".to_string(),
            filename: "startup.md".to_string(),
        });

        // Simulate what get_startup_file command does
        let data = access.take_startup_file().unwrap();
        access.accept_pending_path(&data.path).expect("accept_pending_path should succeed for matching path");

        // current_path should now be set
        assert_eq!(access.current_path(), Some("/tmp/startup.md".to_string()));

        // pending_path should be consumed — accepting again should fail
        assert!(access.accept_pending_path("/tmp/startup.md").is_err());
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

    // --- save_pasted_image tests ---

    /// Minimal valid 1x1 PNG encoded as base64.
    const TINY_PNG_BASE64: &str =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    #[test]
    fn test_save_pasted_image_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        let result = save_pasted_image(
            dir_str,
            TINY_PNG_BASE64.to_string(),
            Some("test-image.png".to_string()),
            Some("png".to_string()),
        );

        assert!(result.is_ok());
        let filename = result.unwrap();
        assert_eq!(filename, "test-image.png");

        let saved_path = dir.path().join("test-image.png");
        assert!(saved_path.exists());

        // Verify the content is valid PNG binary data (starts with PNG magic bytes)
        let data = fs::read(&saved_path).unwrap();
        assert!(data.len() > 8);
        assert_eq!(&data[1..4], b"PNG");
    }

    #[test]
    fn test_save_pasted_image_generates_unique_filename() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        let name1 = save_pasted_image(
            dir_str.clone(),
            TINY_PNG_BASE64.to_string(),
            None,
            Some("png".to_string()),
        )
        .unwrap();

        let name2 = save_pasted_image(
            dir_str,
            TINY_PNG_BASE64.to_string(),
            None,
            Some("png".to_string()),
        )
        .unwrap();

        assert!(name1.starts_with("image-"));
        assert!(name1.ends_with(".png"));
        assert!(name2.starts_with("image-"));
        assert!(name2.ends_with(".png"));
        // Timestamps should produce different names
        assert_ne!(name1, name2);
    }

    #[test]
    fn test_save_pasted_image_rejects_relative_directory() {
        let result = save_pasted_image(
            "relative/path".to_string(),
            TINY_PNG_BASE64.to_string(),
            None,
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Directory path must be absolute"));
    }

    #[test]
    fn test_save_pasted_image_rejects_nonexistent_directory() {
        let result = save_pasted_image(
            "/tmp/nonexistent_dir_mdedit_test_99999".to_string(),
            TINY_PNG_BASE64.to_string(),
            None,
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Directory does not exist"));
    }

    #[test]
    fn test_save_pasted_image_rejects_invalid_base64() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        let result = save_pasted_image(
            dir_str,
            "not-valid-base64!!!".to_string(),
            None,
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid base64 data"));
    }

    #[test]
    fn test_save_pasted_image_rejects_empty_data() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        // Empty string encodes to empty bytes
        let result = save_pasted_image(dir_str, String::new(), None, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_pasted_image_uses_correct_extension() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        let name = save_pasted_image(
            dir_str,
            TINY_PNG_BASE64.to_string(),
            None,
            Some("jpeg".to_string()),
        )
        .unwrap();

        assert!(name.ends_with(".jpg"));
    }

    #[test]
    fn test_save_pasted_image_sanitizes_filename() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        let name = save_pasted_image(
            dir_str,
            TINY_PNG_BASE64.to_string(),
            Some("../evil/../../etc/passwd".to_string()),
            None,
        )
        .unwrap();

        // Path separator characters are stripped — the file stays in the target directory
        assert!(!name.contains('/'));
        // Dots are harmless without path separators — remaining safe chars form the filename
        assert_eq!(name, "..evil....etcpasswd");

        // Verify the file was actually created in the expected directory
        let saved = dir.path().join(&name);
        assert!(saved.exists());
    }

    #[test]
    fn test_save_pasted_image_rejects_dotdot_filename() {
        let dir = tempfile::tempdir().unwrap();
        let dir_str = dir.path().to_string_lossy().to_string();

        // ".." passes the char filter but must be caught by the parent-dir guard
        let result = save_pasted_image(
            dir_str,
            TINY_PNG_BASE64.to_string(),
            Some("..".to_string()),
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid filename"));
    }

    // --- log_error tests ---

    #[test]
    fn test_log_creates_file_and_directory() {
        let dir = tempfile::tempdir().unwrap();
        let log_path = dir.path().join("sub").join("error.log");

        // Sub-directory doesn't exist yet
        assert!(!log_path.exists());

        let line = format_log_line("file-io", "test message", None);
        append_log_line_to(&log_path, &line).unwrap();

        assert!(log_path.exists());
        let content = fs::read_to_string(&log_path).unwrap();
        assert!(content.contains("[file-io] test message"));
    }

    #[test]
    fn test_log_append_behavior() {
        let dir = tempfile::tempdir().unwrap();
        let log_path = dir.path().join("error.log");

        let line1 = format_log_line("file-io", "first error", None);
        let line2 = format_log_line("auto-save", "second error", Some("extra details"));

        append_log_line_to(&log_path, &line1).unwrap();
        append_log_line_to(&log_path, &line2).unwrap();

        let content = fs::read_to_string(&log_path).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("[file-io] first error"));
        assert!(lines[1].contains("[auto-save] second error | extra details"));
    }

    #[test]
    fn test_log_format_with_details() {
        let line = format_log_line("export", "conversion failed", Some("timeout after 5s"));
        // Format: [ISO-8601] [CATEGORY] message | details
        assert!(line.starts_with('['));
        assert!(line.contains("] [export] conversion failed | timeout after 5s\n"));
    }

    #[test]
    fn test_log_format_without_details() {
        let line = format_log_line("general", "something broke", None);
        assert!(line.starts_with('['));
        assert!(line.contains("] [general] something broke\n"));
        // Should NOT contain a pipe separator when no details
        assert!(!line.contains(" | "));
    }

    #[test]
    fn test_log_size_cap_truncation() {
        let dir = tempfile::tempdir().unwrap();
        let log_path = dir.path().join("error.log");

        // Write enough data to exceed 1 MB
        // Each line is ~80 bytes, need ~13000 lines to exceed 1 MB
        let line = format_log_line("general", &"x".repeat(60), None);
        let line_size = line.len();
        let lines_needed = (MAX_LOG_SIZE as usize / line_size) + 100;

        // Write a large block directly to the file first
        {
            let mut file = fs::OpenOptions::new()
                .create(true)
                .write(true)
                .open(&log_path)
                .unwrap();
            for _ in 0..lines_needed {
                file.write_all(line.as_bytes()).unwrap();
            }
        }

        // Verify the file exceeds the cap
        let pre_size = fs::metadata(&log_path).unwrap().len();
        assert!(pre_size > MAX_LOG_SIZE);

        // Append one more line — this should trigger truncation
        let trigger_line = format_log_line("general", "trigger truncation", None);
        append_log_line_to(&log_path, &trigger_line).unwrap();

        // After truncation, the file should be smaller than the cap
        let post_size = fs::metadata(&log_path).unwrap().len();
        assert!(post_size < pre_size);
        assert!(post_size < MAX_LOG_SIZE);

        // The newest entry should still be present
        let content = fs::read_to_string(&log_path).unwrap();
        assert!(content.contains("trigger truncation"));
    }
}
