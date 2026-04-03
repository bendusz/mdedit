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
      if (node.name !== 'FencedCode') return;

      const blockFrom = node.from;
      const blockTo = node.to;

      const firstLine = state.doc.lineAt(blockFrom);
      const lastLine = state.doc.lineAt(blockTo);

      // Check if cursor is inside any line of this code block
      let cursorInside = false;
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        if (cursorLines.has(l)) {
          cursorInside = true;
          break;
        }
      }

      // Apply decorations to each line in the block
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        const line = state.doc.line(l);

        if (!cursorInside && (l === firstLine.number || l === lastLine.number)) {
          // Hide fence content but keep the line. Apply collapsed styling.
          // Line decorations must be pushed before replace decorations at same position.
          lineDecorations.push(
            Decoration.line({ class: 'cm-code-block cm-code-fence' }).range(line.from),
          );
          if (line.to > line.from) {
            replaceDecorations.push(Decoration.replace({}).range(line.from, line.to));
          }
          continue;
        }

        lineDecorations.push(
          Decoration.line({ class: 'cm-code-block' }).range(line.from),
        );
      }
    },
  });

  // Line decorations must come before replace decorations in RangeSet.
  // Build separate sorted sets and merge them.
  lineDecorations.sort((a, b) => a.from - b.from);
  replaceDecorations.sort((a, b) => a.from - b.from);

  const lineSet = Decoration.set(lineDecorations);
  const replaceSet = Decoration.set(replaceDecorations);

  return lineSet.update({ add: replaceDecorations, sort: true });
}

export const codeBlockDecoration = ViewPlugin.fromClass(
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

export const codeBlockStyles = EditorView.baseTheme({
  '.cm-code-block': {
    backgroundColor: '#f3f4f6',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: '0.9em',
    padding: '0 8px',
  },
  '.cm-code-fence': {
    fontSize: '0',
    lineHeight: '0',
    padding: '0',
    minHeight: '0',
  },
});
