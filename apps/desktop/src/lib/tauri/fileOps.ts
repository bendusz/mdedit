import { invoke } from '@tauri-apps/api/core';

export interface FileData {
  path: string;
  content: string;
  filename: string;
}

/** Show native open dialog (Rust-owned) and read the selected file. */
export function openFileDialog(): Promise<FileData | null> {
  return invoke<FileData | null>('open_file_dialog');
}

/** Save content to the current Rust-tracked file path (atomic write). */
export function saveCurrentFile(content: string): Promise<void> {
  return invoke<void>('save_current_file', { content });
}

/** Show native save-as dialog (Rust-owned), write file, return metadata. */
export function saveFileAsDialog(content: string): Promise<FileData | null> {
  return invoke<FileData | null>('save_file_as_dialog', { content });
}

/** Accept the most recently queued Rust-owned external file open. */
export function acceptPendingFile(path: string): Promise<void> {
  return invoke<void>('accept_pending_file', { path });
}

/** Clear the Rust-tracked current file path for new/untitled documents. */
export function clearCurrentFile(): Promise<void> {
  return invoke<void>('clear_current_file');
}

/** Get the list of recently opened file paths. */
export function getRecentFiles(): Promise<string[]> {
  return invoke<string[]>('get_recent_files');
}

/** Add a file path to the recent files list. */
export function addToRecent(path: string): Promise<void> {
  return invoke('add_to_recent', { path });
}

/** Show native save dialog with HTML filter, write HTML content, return saved path or null. */
export function exportHtmlDialog(htmlContent: string): Promise<string | null> {
  return invoke<string | null>('export_html_dialog', { htmlContent });
}
