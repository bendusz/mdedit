import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

// --- Built-in themes ---

export const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1a1a1a' },
  '.cm-content': { caretColor: '#1a1a1a' },
  '.cm-cursor': { borderLeftColor: '#1a1a1a' },
  '.cm-activeLine': { backgroundColor: '#f3f4f620' },
  '.cm-selectionBackground': { backgroundColor: '#3b82f630' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#3b82f640' },
}, { dark: false });

export const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#1e1e2e', color: '#cdd6f4' },
  '.cm-content': { caretColor: '#cdd6f4' },
  '.cm-cursor': { borderLeftColor: '#cdd6f4' },
  '.cm-activeLine': { backgroundColor: '#313244' },
  '.cm-selectionBackground': { backgroundColor: '#45475a' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#585b70' },
}, { dark: true });

// --- Solarized ---

export const solarizedLight = EditorView.theme({
  '&': { backgroundColor: '#fdf6e3', color: '#657b83' },
  '.cm-content': { caretColor: '#657b83' },
  '.cm-cursor': { borderLeftColor: '#657b83' },
  '.cm-activeLine': { backgroundColor: '#eee8d520' },
  '.cm-selectionBackground': { backgroundColor: '#268bd230' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#268bd240' },
}, { dark: false });

export const solarizedDark = EditorView.theme({
  '&': { backgroundColor: '#002b36', color: '#839496' },
  '.cm-content': { caretColor: '#839496' },
  '.cm-cursor': { borderLeftColor: '#839496' },
  '.cm-activeLine': { backgroundColor: '#073642' },
  '.cm-selectionBackground': { backgroundColor: '#586e7540' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#586e7560' },
}, { dark: true });

// --- Nord (dark only) ---

export const nordDark = EditorView.theme({
  '&': { backgroundColor: '#2e3440', color: '#d8dee9' },
  '.cm-content': { caretColor: '#d8dee9' },
  '.cm-cursor': { borderLeftColor: '#d8dee9' },
  '.cm-activeLine': { backgroundColor: '#3b4252' },
  '.cm-selectionBackground': { backgroundColor: '#434c5e' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#4c566a' },
}, { dark: true });

// --- Sepia (light only) ---

export const sepiaLight = EditorView.theme({
  '&': { backgroundColor: '#f4ecd8', color: '#5b4636' },
  '.cm-content': { caretColor: '#5b4636' },
  '.cm-cursor': { borderLeftColor: '#5b4636' },
  '.cm-activeLine': { backgroundColor: '#efe6d020' },
  '.cm-selectionBackground': { backgroundColor: '#c4a88230' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#c4a88240' },
}, { dark: false });

// --- Theme Registry ---

export type ThemeId = 'light' | 'dark' | 'solarized-light' | 'solarized-dark' | 'nord' | 'sepia';

export const themes: Record<ThemeId, Extension> = {
  'light': lightTheme,
  'dark': darkTheme,
  'solarized-light': solarizedLight,
  'solarized-dark': solarizedDark,
  'nord': nordDark,
  'sepia': sepiaLight,
};

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  isDark: boolean;
}

export const themeList: ThemeInfo[] = [
  { id: 'light', label: 'Light', isDark: false },
  { id: 'dark', label: 'Dark', isDark: true },
  { id: 'solarized-light', label: 'Solarized Light', isDark: false },
  { id: 'solarized-dark', label: 'Solarized Dark', isDark: true },
  { id: 'nord', label: 'Nord', isDark: true },
  { id: 'sepia', label: 'Sepia', isDark: false },
];

/** Get a CM6 theme extension by ID. */
export function getTheme(id: ThemeId): Extension {
  return themes[id];
}

/** Check whether a theme ID corresponds to a dark theme. */
export function isThemeDark(id: ThemeId): boolean {
  const info = themeList.find((t) => t.id === id);
  return info?.isDark ?? false;
}
