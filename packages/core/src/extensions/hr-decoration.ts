import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

class HRWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'cm-hr-widget';
    hr.style.border = 'none';
    hr.style.borderTop = '2px solid #d1d5db';
    hr.style.margin = '8px 0';
    return hr;
  }

  eq(): boolean {
    return true;
  }
}

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
      if (node.name !== 'HorizontalRule') return;

      const line = state.doc.lineAt(node.from);

      // Apply line class
      lineDecorations.push(
        Decoration.line({ class: 'cm-hr' }).range(line.from),
      );

      // When cursor is NOT on this line, replace the marker with an HR widget
      if (!cursorLines.has(line.number)) {
        replaceDecorations.push(
          Decoration.replace({
            widget: new HRWidget(),
          }).range(line.from, line.to),
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

export const hrDecoration = ViewPlugin.fromClass(
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

export const hrStyles = EditorView.baseTheme({
  '.cm-hr': {},
});
