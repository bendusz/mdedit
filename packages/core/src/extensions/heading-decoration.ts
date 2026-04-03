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
  SetextHeading1: 'cm-heading-1',
  SetextHeading2: 'cm-heading-2',
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

        // If cursor is NOT on this heading line, hide markers
        if (!cursorLines.has(line.number)) {
          const isSetext = node.name.startsWith('Setext');

          if (isSetext) {
            // For setext headings, hide the underline row (=== or ---)
            const endLine = state.doc.lineAt(node.to);
            if (endLine.number !== line.number) {
              decorations.push(
                Decoration.replace({}).range(endLine.from - 1, endLine.to),
              );
            }
          } else {
            // For ATX headings, hide all HeaderMark nodes and surrounding whitespace
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
              let isFirst = true;
              do {
                if (cursor.name === 'HeaderMark') {
                  if (isFirst) {
                    // Leading marks: hide from mark start through all trailing spaces
                    let hideEnd = cursor.to;
                    while (hideEnd < line.to && state.doc.sliceString(hideEnd, hideEnd + 1) === ' ') {
                      hideEnd++;
                    }
                    decorations.push(
                      Decoration.replace({}).range(cursor.from, hideEnd),
                    );
                    isFirst = false;
                  } else {
                    // Closing marks (e.g. `# Title ##`): hide from preceding space through end
                    let hideStart = cursor.from;
                    while (hideStart > line.from && state.doc.sliceString(hideStart - 1, hideStart) === ' ') {
                      hideStart--;
                    }
                    decorations.push(
                      Decoration.replace({}).range(hideStart, cursor.to),
                    );
                  }
                }
              } while (cursor.nextSibling());
            }
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
