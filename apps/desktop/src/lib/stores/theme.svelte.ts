type ThemeMode = 'system' | 'light' | 'dark';
let mode = $state<ThemeMode>('system');
let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  systemDark = e.matches;
});

export const themeState = {
  get mode() { return mode; },
  get isDark() { return mode === 'system' ? systemDark : mode === 'dark'; },
  setMode(newMode: ThemeMode) { mode = newMode; },
  toggle() {
    mode = mode === 'system'
      ? (systemDark ? 'light' : 'dark')
      : mode === 'dark' ? 'light' : 'dark';
  },
};
