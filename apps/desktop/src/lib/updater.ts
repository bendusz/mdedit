import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

export interface UpdateResult {
  info: UpdateInfo;
  downloadAndInstall: (onProgress?: (event: DownloadProgress) => void) => Promise<void>;
}

export interface DownloadProgress {
  event: string;
  data: {
    contentLength?: number;
    chunkLength?: number;
  };
}

export type CheckResult =
  | { status: 'update-available'; result: UpdateResult }
  | { status: 'up-to-date' }
  | { status: 'error'; message: string };

/**
 * Check for available updates.
 * Returns a discriminated CheckResult so callers can distinguish "no update",
 * "update available", and "check failed" cases.
 */
export async function checkForUpdates(): Promise<CheckResult> {
  try {
    const update = await check();
    if (!update) return { status: 'up-to-date' };

    const result: UpdateResult = {
      info: {
        version: update.version,
        body: update.body ?? undefined,
        date: update.date ?? undefined,
      },
      downloadAndInstall: async (onProgress) => {
        await update.downloadAndInstall((event) => {
          onProgress?.({
            event: event.event,
            data: event.event !== 'Finished'
              ? {
                  contentLength: (event.data as Record<string, unknown>)?.contentLength as number | undefined,
                  chunkLength: (event.data as Record<string, unknown>)?.chunkLength as number | undefined,
                }
              : {},
          });
        });
        await relaunch();
      },
    };
    return { status: 'update-available', result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Failed to check for updates:', e);
    return { status: 'error', message };
  }
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const STARTUP_DELAY_MS = 5_000; // 5 seconds after mount

let intervalId: ReturnType<typeof setInterval> | null = null;
let startupTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Start periodic update checks. Calls the provided callback when an update is found.
 * Checks once after a short startup delay, then every 4 hours.
 */
export function startUpdateChecker(onUpdate: (result: UpdateResult) => void): void {
  stopUpdateChecker();

  const doCheck = async () => {
    const result = await checkForUpdates();
    if (result.status === 'update-available') {
      onUpdate(result.result);
    }
  };

  startupTimeoutId = setTimeout(() => {
    void doCheck();
    intervalId = setInterval(() => void doCheck(), CHECK_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

/**
 * Stop periodic update checks and clean up timers.
 */
export function stopUpdateChecker(): void {
  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
