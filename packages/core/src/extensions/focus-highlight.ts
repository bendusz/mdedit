import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

const unfocusedLine = Decoration.line({ class: 'cm-unfocused-line' });

/**
 * Determine the paragraph boundaries around the cursor.
 * A paragraph is a contiguous block of non-empty lines.
 * Returns [startLine, endLine] (1-based line numbers).
 */
function getCursorParagraph(state: EditorState): [number, number] {
  const cursorPos = state.selection.main.head;
  const cursorLineNumber = state.doc.lineAt(cursorPos).number;
  const totalLines = state.doc.lines;

  // Expand upward to find paragraph start
  let startLine = cursorLineNumber;
  while (startLine > 1) {
    const prevLine = state.doc.line(startLine - 1);
    if (prevLine.text.trim() === '') break;
    startLine--;
  }

  // Expand downward to find paragraph end
  let endLine = cursorLineNumber;
  while (endLine < totalLines) {
    const nextLine = state.doc.line(endLine + 1);
    if (nextLine.text.trim() === '') break;
    endLine++;
  }

  return [startLine, endLine];
}

function buildDecorations(state: EditorState): DecorationSet {
  const [paraStart, paraEnd] = getCursorParagraph(state);
  const decorations: Range<Decoration>[] = [];
  const totalLines = state.doc.lines;

  for (let i = 1; i <= totalLines; i++) {
    if (i < paraStart || i > paraEnd) {
      const line = state.doc.line(i);
      decorations.push(unfocusedLine.range(line.from));
    }
  }

  return Decoration.set(decorations);
}

const focusHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

const focusHighlightStyles = EditorView.baseTheme({
  '.cm-unfocused-line': {
    opacity: '0.3',
    transition: 'opacity 0.2s ease',
  },
});

/**
 * Returns a focus highlight extension that dims all paragraphs except
 * the one containing the cursor. Designed for zen/focus mode — opt-in only,
 * not included in the default livePreview extensions.
 */
export function focusHighlight() {
  return [focusHighlightPlugin, focusHighlightStyles];
}
