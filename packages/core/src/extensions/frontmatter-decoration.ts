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

      // Apply decorations to each line in the frontmatter block
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        const line = state.doc.line(l);

        if (l === firstLine.number || l === lastLine.number) {
          // Delimiter lines (---)
          if (!cursorInside) {
            // When cursor is outside, hide the delimiter content
            lineDecorations.push(
              Decoration.line({ class: 'cm-frontmatter cm-frontmatter-delimiter-line' }).range(line.from),
            );
            if (line.to > line.from) {
              replaceDecorations.push(
                Decoration.replace({}).range(line.from, line.to),
              );
            }
          } else {
            // When cursor is inside, show delimiter with styling
            lineDecorations.push(
              Decoration.line({ class: 'cm-frontmatter cm-frontmatter-delimiter' }).range(line.from),
            );
          }
        } else {
          // Content lines — style as frontmatter content
          if (!cursorInside) {
            // Styled view: apply key-value styling via line class
            lineDecorations.push(
              Decoration.line({ class: 'cm-frontmatter cm-frontmatter-content' }).range(line.from),
            );

            // Parse key: value and apply inline decorations
            const text = state.doc.sliceString(line.from, line.to);
            const colonIndex = text.indexOf(':');
            if (colonIndex > 0) {
              // Style the key portion (before the colon, inclusive)
              replaceDecorations.push(
                Decoration.mark({ class: 'cm-frontmatter-key' }).range(
                  line.from,
                  line.from + colonIndex + 1,
                ),
              );
              // Style the value portion (after the colon)
              const valueStart = line.from + colonIndex + 1;
              if (valueStart < line.to) {
                replaceDecorations.push(
                  Decoration.mark({ class: 'cm-frontmatter-value' }).range(
                    valueStart,
                    line.to,
                  ),
                );
              }
            }
          } else {
            // Cursor inside: show raw source with subtle background
            lineDecorations.push(
              Decoration.line({ class: 'cm-frontmatter cm-frontmatter-raw' }).range(line.from),
            );
          }
        }
      }

      // Don't descend into child nodes
      return false;
    },
  });

  // Line decorations must come before replace decorations at same position.
  lineDecorations.sort((a, b) => a.from - b.from);
  replaceDecorations.sort((a, b) => a.from - b.from);

  const lineSet = Decoration.set(lineDecorations);
  return lineSet.update({ add: replaceDecorations, sort: true });
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
  // Container styling for frontmatter content lines
  '.cm-frontmatter': {
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: '0.85em',
  },
  // When cursor is outside: styled content view
  '.cm-frontmatter-content': {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderLeft: '2px solid rgba(59, 130, 246, 0.3)',
    paddingLeft: '8px',
  },
  '.cm-frontmatter-key': {
    fontWeight: '600',
    color: '#6366f1',
  },
  '.cm-frontmatter-value': {
    color: '#64748b',
  },
  // Hidden delimiter lines (collapsed when cursor outside)
  '.cm-frontmatter-delimiter-line': {
    fontSize: '0',
    lineHeight: '0',
    padding: '0',
    minHeight: '0',
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
  '&dark .cm-frontmatter-content': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderLeftColor: 'rgba(99, 102, 241, 0.4)',
  },
  '&dark .cm-frontmatter-key': {
    color: '#a5b4fc',
  },
  '&dark .cm-frontmatter-value': {
    color: '#94a3b8',
  },
  '&dark .cm-frontmatter-delimiter': {
    color: '#64748b',
  },
  '&dark .cm-frontmatter-raw': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderLeftColor: 'rgba(99, 102, 241, 0.4)',
  },
});
