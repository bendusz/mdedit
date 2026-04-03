import type { EditorState } from '@codemirror/state';

export interface CursorInfo {
  line: number;
  col: number;
  wordCount: number;
  charCount: number;
}

export function getCursorInfo(state: EditorState): CursorInfo {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const col = pos - line.from + 1;
  const text = state.doc.toString();
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  return { line: line.number, col, wordCount: words, charCount: text.length };
}
