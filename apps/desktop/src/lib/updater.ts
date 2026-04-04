import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

declare const __MDEDIT_UPDATER_ENABLED__: boolean;
declare const __MDEDIT_UPDATER_PUBKEY__: string;

const PLACEHOLDER_PUBKEY = 'REPLACE_WITH_REAL_PUBLIC_KEY_BEFORE_RELEASE';

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

export interface UpdateResult {
  info: UpdateInfo;
  downloadAndInstall: (onProgress?: (event: DownloadProgress) => void) => Promise<void>;
  close: () => Promise<void>;
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
  | { status: 'disabled' }
  | { status: 'error'; message: string };

/**
 * The updater is enabled only when the build-time flag is true AND the pubkey
 * has been substituted with a real value. This prevents dev builds from
 * attempting update checks with a placeholder key.
 */
export const updaterEnabled =
  __MDEDIT_UPDATER_ENABLED__ && __MDEDIT_UPDATER_PUBKEY__ !== PLACEHOLDER_PUBKEY;

/**
 * Check for available updates.
 * Returns a discriminated CheckResult so callers can distinguish "no update",
 * "update available", and "check failed" cases.
 */
export async function checkForUpdates(): Promise<CheckResult> {
  if (!updaterEnabled) {
    return { status: 'disabled' };
  }

  try {
    const update = await check();
    if (!update) return { status: 'up-to-date' };

    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await update.close();
    };

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
        await close();
        await relaunch();
      },
      close,
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
  if (!updaterEnabled) {
    return;
  }

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
