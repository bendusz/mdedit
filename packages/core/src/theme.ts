import { EditorView } from '@codemirror/view';

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
