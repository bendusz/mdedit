import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

function buildLinkDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  // Determine which lines the cursor is on
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
      if (node.name !== 'Link') return;

      // Check if ANY line spanned by the link node has the cursor
      const startLine = state.doc.lineAt(node.from).number;
      const endLine = state.doc.lineAt(node.to).number;
      for (let l = startLine; l <= endLine; l++) {
        if (cursorLines.has(l)) return false;
      }

      // Walk child nodes to find the structure:
      // Link contains: LinkMark([), link text, LinkMark(]), LinkMark((), URL, LinkMark())
      // We need to:
      // 1. Hide the opening [ (first LinkMark)
      // 2. Style the link text with .cm-link
      // 3. Hide from ] through to end of node (i.e. ](url))

      let openBracketEnd = -1;
      let closeBracketFrom = -1;

      let child = node.node.firstChild;
      let linkMarkIndex = 0;
      while (child) {
        if (child.name === 'LinkMark') {
          if (linkMarkIndex === 0) {
            // Opening [ — hide it
            openBracketEnd = child.to;
            decorations.push(
              Decoration.replace({}).range(child.from, child.to),
            );
          } else if (linkMarkIndex === 1) {
            // Closing ] — this starts the range we hide to end of node
            closeBracketFrom = child.from;
          }
          // We don't need to handle ( and ) LinkMarks individually —
          // they're all hidden by the range from ] to end of node
          linkMarkIndex++;
        }
        child = child.nextSibling;
      }

      // Style the link text (between [ and ])
      if (openBracketEnd >= 0 && closeBracketFrom >= 0 && closeBracketFrom > openBracketEnd) {
        decorations.push(
          Decoration.mark({ class: 'cm-link' }).range(openBracketEnd, closeBracketFrom),
        );
      }

      // Hide from ] through end of node (covers ](url))
      if (closeBracketFrom >= 0 && node.to > closeBracketFrom) {
        decorations.push(
          Decoration.replace({}).range(closeBracketFrom, node.to),
        );
      }

      // Skip children — we handled them above
      return false;
    },
  });

  // Sort decorations by from position (required by RangeSet)
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  return Decoration.set(decorations);
}

export const linkDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLinkDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildLinkDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export const linkStyles = EditorView.baseTheme({
  '.cm-link': { color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' },
});
