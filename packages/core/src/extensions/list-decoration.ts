import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private pos: number,
    private view: EditorView,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-task-checkbox';
    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const newChar = this.checked ? ' ' : 'x';
      this.view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: newChar },
      });
    });
    return input;
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.pos === other.pos;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const state = view.state;
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
      if (node.name !== 'ListItem') return;

      const line = state.doc.lineAt(node.from);
      const lineText = state.doc.sliceString(line.from, line.to);

      // Check for task list pattern: - [ ] or - [x]
      const taskMatch = lineText.match(/^(\s*[-*+]\s+)\[([ x])\]\s/);
      if (!taskMatch) return;

      const checked = taskMatch[2] === 'x';

      // Apply task-list line class
      lineDecorations.push(
        Decoration.line({ class: 'cm-task-list' }).range(line.from),
      );

      // When cursor is NOT on this line, replace the entire marker with a checkbox widget
      if (!cursorLines.has(line.number)) {
        // The full prefix to replace: "- [ ] " or "  - [x] " etc.
        const fullPrefix = taskMatch[0];
        // Position of the [ bracket in the document
        const bracketPos = line.from + taskMatch[1].length;

        replaceDecorations.push(
          Decoration.replace({
            widget: new CheckboxWidget(checked, bracketPos, view),
          }).range(line.from, line.from + fullPrefix.length),
        );
      }
    },
  });

  // Line decorations must come before replace decorations at same position
  lineDecorations.sort((a, b) => a.from - b.from);
  replaceDecorations.sort((a, b) => a.from - b.from);

  const lineSet = Decoration.set(lineDecorations);
  return lineSet.update({ add: replaceDecorations, sort: true });
}

export const listDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export const listStyles = EditorView.baseTheme({
  '.cm-task-list': {},
  '.cm-task-checkbox': {
    cursor: 'pointer',
    verticalAlign: 'middle',
    marginRight: '4px',
  },
});
