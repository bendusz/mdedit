import { invoke } from '@tauri-apps/api/core';

export interface FileData {
  path: string;
  content: string;
  filename: string;
}

/** Open a file by absolute path. */
export function openFile(path: string): Promise<FileData> {
  return invoke<FileData>('open_file', { path });
}

/** Show native open dialog (Rust-owned) and read the selected file. */
export function openFileDialog(): Promise<FileData | null> {
  return invoke<FileData | null>('open_file_dialog');
}

/** Save content to an existing file path (atomic write). */
export function saveFile(path: string, content: string): Promise<void> {
  return invoke<void>('save_file', { path, content });
}

/** Show native save-as dialog (Rust-owned), write file, return metadata. */
export function saveFileAsDialog(content: string): Promise<FileData | null> {
  return invoke<FileData | null>('save_file_as_dialog', { content });
}

/** Get the list of recently opened file paths. */
export function getRecentFiles(): Promise<string[]> {
  return invoke<string[]>('get_recent_files');
}

/** Add a file path to the recent files list. */
export function addToRecent(path: string): Promise<void> {
  return invoke('add_to_recent', { path });
}
