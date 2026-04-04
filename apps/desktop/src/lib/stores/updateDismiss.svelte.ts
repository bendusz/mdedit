const STORAGE_KEY = 'mdedit-dismissed-update';

function loadDismissedVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable
  }
  return null;
}

let dismissedVersion = $state<string | null>(loadDismissedVersion());

export const updateDismissState = {
  /** Returns true if the given version was previously dismissed. */
  isDismissed(version: string): boolean {
    return dismissedVersion === version;
  },

  /** Marks the given version as dismissed, persisting to localStorage. */
  dismiss(version: string): void {
    dismissedVersion = version;
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {
      // localStorage may be unavailable
    }
  },

  /** Clears the stored dismissal (e.g., when a new version supersedes). */
  clearDismissal(): void {
    dismissedVersion = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage may be unavailable
    }
  },
};
