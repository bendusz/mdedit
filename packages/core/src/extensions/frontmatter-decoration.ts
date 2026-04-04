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
      if (node.name !== 'FrontmatterBlock') return;

      const blockFrom = node.from;
      const blockTo = node.to;

      const firstLine = state.doc.lineAt(blockFrom);
      const lastLine = state.doc.lineAt(blockTo);

      // Check if the cursor is inside any line of the frontmatter block
      let cursorInside = false;
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        if (cursorLines.has(l)) {
          cursorInside = true;
          break;
        }
      }

      // When cursor is outside the frontmatter block, the frontmatter-editor
      // widget handles the entire block with a replace decoration. We only
      // apply line-level decorations when the cursor IS inside.
      if (!cursorInside) return false;

      // Apply decorations to each line in the frontmatter block
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        const line = state.doc.line(l);

        if (l === firstLine.number || l === lastLine.number) {
          // When cursor is inside, show delimiter with styling
          lineDecorations.push(
            Decoration.line({ class: 'cm-frontmatter cm-frontmatter-delimiter' }).range(line.from),
          );
        } else {
          // Cursor inside: show raw source with subtle background
          lineDecorations.push(
            Decoration.line({ class: 'cm-frontmatter cm-frontmatter-raw' }).range(line.from),
          );
        }
      }

      // Don't descend into child nodes
      return false;
    },
  });

  lineDecorations.sort((a, b) => a.from - b.from);
  return Decoration.set(lineDecorations);
}

export const frontmatterDecoration = ViewPlugin.fromClass(
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

export const frontmatterStyles = EditorView.baseTheme({
  // Container styling for frontmatter lines (cursor inside)
  '.cm-frontmatter': {
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: '0.85em',
  },
  // Visible delimiter lines (when cursor inside)
  '.cm-frontmatter-delimiter': {
    color: '#94a3b8',
  },
  // Raw source view (cursor inside)
  '.cm-frontmatter-raw': {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderLeft: '2px solid rgba(59, 130, 246, 0.3)',
    paddingLeft: '8px',
  },
  // Dark mode variants
  '&dark .cm-frontmatter-delimiter': {
    color: '#64748b',
  },
  '&dark .cm-frontmatter-raw': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderLeftColor: 'rgba(99, 102, 241, 0.4)',
  },
});
