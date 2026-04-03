import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type Extension, type Range, StateField } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';
import { parseTable, addColumn, addRow } from './table-editor';

/**
 * Widget that renders an "add column" (+) button at the right edge of a table.
 */
class AddColumnWidget extends WidgetType {
  constructor(private tableFrom: number) {
    super();
  }

  eq(other: AddColumnWidget): boolean {
    return this.tableFrom === other.tableFrom;
  }

  toDOM(view: EditorView): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'cm-table-add-col';
    btn.textContent = '+';
    btn.title = 'Add column';
    btn.setAttribute('aria-label', 'Add column');
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const table = parseTable(view.state, this.tableFrom);
      if (table) addColumn(view, table);
    });
    return btn;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Widget that renders an "add row" (+) button below the table.
 */
class AddRowWidget extends WidgetType {
  constructor(private tableFrom: number) {
    super();
  }

  eq(other: AddRowWidget): boolean {
    return this.tableFrom === other.tableFrom;
  }

  toDOM(view: EditorView): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'cm-table-add-row';
    btn.textContent = '+';
    btn.title = 'Add row';
    btn.setAttribute('aria-label', 'Add row');
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const table = parseTable(view.state, this.tableFrom);
      if (table) addRow(view, table);
    });
    return btn;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Build widget decorations for tables that contain the cursor.
 * Shows add-column and add-row buttons when the cursor is inside a table.
 */
function buildTableWidgets(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  // Collect cursor positions
  const cursorPositions = state.selection.ranges.map((r) => r.head);

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return;

      // Check if any cursor is inside this table
      const isCursorInside = cursorPositions.some(
        (pos) => pos >= node.from && pos <= node.to,
      );
      if (!isCursorInside) return false;

      const tableFrom = node.from;
      const tableTo = node.to;
      const lastLine = state.doc.lineAt(tableTo);

      // Add-column widget: inline widget at the end of the first line of the table
      const firstLine = state.doc.lineAt(tableFrom);
      decorations.push(
        Decoration.widget({
          widget: new AddColumnWidget(tableFrom),
          side: 1,
        }).range(firstLine.to),
      );

      // Add-row widget: block widget after the last line of the table
      decorations.push(
        Decoration.widget({
          widget: new AddRowWidget(tableFrom),
          block: true,
          side: 1,
        }).range(lastLine.to),
      );

      return false;
    },
  });

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

/**
 * StateField that provides table editor widget decorations.
 * Block decorations (add-row button) require a StateField, not a ViewPlugin.
 */
const tableWidgetField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableWidgets(state);
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildTableWidgets(tr.state);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/** Styles for the table editor widget buttons. */
export const tableWidgetStyles = EditorView.baseTheme({
  '.cm-table-add-col': {
    display: 'inline-block',
    marginLeft: '4px',
    width: '20px',
    height: '20px',
    lineHeight: '18px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#6b7280',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    verticalAlign: 'middle',
    padding: '0',
    fontFamily: 'system-ui, sans-serif',
  },
  '.cm-table-add-col:hover': {
    background: '#e5e7eb',
    color: '#374151',
  },
  '.cm-table-add-row': {
    display: 'block',
    width: '20px',
    height: '20px',
    lineHeight: '18px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#6b7280',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '2px 0 4px 0',
    padding: '0',
    fontFamily: 'system-ui, sans-serif',
  },
  '.cm-table-add-row:hover': {
    background: '#e5e7eb',
    color: '#374151',
  },
  // Dark theme overrides
  '&dark .cm-table-add-col': {
    color: '#9ca3af',
    background: '#374151',
    border: '1px solid #4b5563',
  },
  '&dark .cm-table-add-col:hover': {
    background: '#4b5563',
    color: '#e5e7eb',
  },
  '&dark .cm-table-add-row': {
    color: '#9ca3af',
    background: '#374151',
    border: '1px solid #4b5563',
  },
  '&dark .cm-table-add-row:hover': {
    background: '#4b5563',
    color: '#e5e7eb',
  },
});

/** Table editor extension: widget buttons + styles. */
export const tableWidget: Extension = [tableWidgetField, tableWidgetStyles];
