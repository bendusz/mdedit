import { invoke } from '@tauri-apps/api/core';

export type LogCategory = 'file-io' | 'auto-save' | 'export' | 'update' | 'paste' | 'general';

/**
 * Log a structured error to ~/.mdedit/error.log via the Rust backend.
 * Also logs to console.error for dev convenience.
 */
export async function logError(
  category: LogCategory,
  message: string,
  details?: string,
): Promise<void> {
  // Always log to console for dev tools visibility
  if (details) {
    console.error(`[${category}] ${message}`, details);
  } else {
    console.error(`[${category}] ${message}`);
  }

  try {
    await invoke('log_error', { category, message, details: details ?? null });
  } catch (e) {
    // If logging itself fails, we can only fall back to console
    console.error('Failed to write to error log:', e);
  }
}

/** Get the path to the error log file. */
export function getLogPath(): Promise<string> {
  return invoke<string>('get_log_path');
}
