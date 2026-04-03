import { themeList, isThemeDark, type ThemeId } from '@mdedit/core';

const STORAGE_KEY = 'mdedit-theme';

type ThemeMode = 'system' | ThemeId;

function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'system') return 'system';
    if (stored && themeList.some((t) => t.id === stored)) {
      return stored as ThemeId;
    }
  } catch {
    // localStorage may be unavailable
  }
  return 'system';
}

let mode = $state<ThemeMode>(loadThemeMode());
let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  systemDark = e.matches;
});

function resolveThemeId(m: ThemeMode): ThemeId {
  if (m === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return m;
}

export const themeState = {
  get mode() { return mode; },
  get themeId(): ThemeId { return resolveThemeId(mode); },
  get isDark() { return isThemeDark(resolveThemeId(mode)); },

  setMode(newMode: ThemeMode) {
    mode = newMode;
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage may be unavailable
    }
  },

  setTheme(id: ThemeId) {
    mode = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage may be unavailable
    }
  },
};
