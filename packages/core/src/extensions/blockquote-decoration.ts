import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

function buildDecorations(state: EditorState): DecorationSet {
  const lineDecorations: Range<Decoration>[] = [];
  const replaceDecorations: Range<Decoration>[] = [];

  // Collect all lines the cursor touches
  const cursorLines = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      cursorLines.add(l);
    }
  }

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Blockquote') return;

      const firstLine = state.doc.lineAt(node.from);
      const lastLine = state.doc.lineAt(node.to);

      for (let l = firstLine.number; l <= lastLine.number; l++) {
        const line = state.doc.line(l);

        // Apply line class to every blockquote line
        lineDecorations.push(
          Decoration.line({ class: 'cm-blockquote' }).range(line.from),
        );

        // When cursor is NOT on this line, hide the > marker and trailing space
        if (!cursorLines.has(l)) {
          const lineText = state.doc.sliceString(line.from, line.to);
          const match = lineText.match(/^(\s*>\s?)/);
          if (match) {
            replaceDecorations.push(
              Decoration.replace({}).range(line.from, line.from + match[1].length),
            );
          }
        }
      }
    },
  });

  // Line decorations must come before replace decorations at same position
  lineDecorations.sort((a, b) => a.from - b.from);
  replaceDecorations.sort((a, b) => a.from - b.from);

  const lineSet = Decoration.set(lineDecorations);
  return lineSet.update({ add: replaceDecorations, sort: true });
}

export const blockquoteDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export const blockquoteStyles = EditorView.baseTheme({
  '.cm-blockquote': {
    borderLeft: '3px solid #d1d5db',
    paddingLeft: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
});
