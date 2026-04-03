import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

const headingClasses: Record<string, string> = {
  ATXHeading1: 'cm-heading-1',
  ATXHeading2: 'cm-heading-2',
  ATXHeading3: 'cm-heading-3',
  ATXHeading4: 'cm-heading-4',
  ATXHeading5: 'cm-heading-5',
  ATXHeading6: 'cm-heading-6',
};

function buildDecorations(state: EditorState): DecorationSet {
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
      const cls = headingClasses[node.name];
      if (cls) {
        const line = state.doc.lineAt(node.from);
        // Apply the heading class as a line decoration
        decorations.push(
          Decoration.line({ class: cls }).range(line.from),
        );

        // If cursor is NOT on this heading line, hide the HeaderMark (# symbols)
        if (!cursorLines.has(line.number)) {
          // Walk children to find HeaderMark nodes
          const cursor = node.node.cursor();
          if (cursor.firstChild()) {
            do {
              if (cursor.name === 'HeaderMark') {
                // Replace the HeaderMark and trailing space with nothing
                const markEnd = cursor.to;
                // Include the space after the # marks if present
                const afterMark =
                  markEnd < line.to && state.doc.sliceString(markEnd, markEnd + 1) === ' '
                    ? markEnd + 1
                    : markEnd;
                decorations.push(
                  Decoration.replace({}).range(cursor.from, afterMark),
                );
              }
            } while (cursor.nextSibling());
          }
        }
      }
    },
  });

  // Sort decorations by from position (required by RangeSet)
  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(decorations);
}

export const headingDecoration = ViewPlugin.fromClass(
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
