import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';
import {
  parseTable,
  addColumn,
  removeColumn,
  addRow,
  removeRow,
} from '../src/extensions/table-editor';

describe('table-editor', () => {
  let container: HTMLElement;
  let view: EditorView;

  function createWithContent(content: string, cursorPos: number): EditorView {
    view = createEditor({ parent: container, content });
    view.dispatch({ selection: { anchor: cursorPos } });
    return view;
  }

  function docText(): string {
    return view.state.doc.toString();
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  const simpleTable = [
    '| H1 | H2 |',
    '| -- | -- |',
    '| A  | B  |',
    '| C  | D  |',
  ].join('\n');

  describe('parseTable', () => {
    it('should parse a simple 2x2 table', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5);
      expect(table).not.toBeNull();
      expect(table!.rows.length).toBe(4); // header + separator + 2 data rows
      expect(table!.rows[0]).toEqual(['H1', 'H2']);
      expect(table!.alignments).toEqual(['none', 'none']);
      expect(table!.headerRow).toBe(0);
      expect(table!.from).toBe(0);
      expect(table!.to).toBe(simpleTable.length);
    });

    it('should return null when cursor is not in a table', () => {
      const content = 'Hello world\n\nSome text';
      createWithContent(content, 5);
      const table = parseTable(view.state, 5);
      expect(table).toBeNull();
    });

    it('should return null when cursor is outside the table', () => {
      const content = 'Before\n\n' + simpleTable + '\n\nAfter';
      createWithContent(content, 2); // cursor in "Before"
      const table = parseTable(view.state, 2);
      expect(table).toBeNull();
    });

    it('should parse a table with different alignments', () => {
      const alignedTable = [
        '| Left | Center | Right |',
        '| :--- | :----: | ----: |',
        '| A    | B      | C     |',
      ].join('\n');
      createWithContent(alignedTable, 5);
      const table = parseTable(view.state, 5);
      expect(table).not.toBeNull();
      expect(table!.alignments).toEqual(['left', 'center', 'right']);
    });

    it('should parse a table embedded in other content', () => {
      const content = '# Title\n\n' + simpleTable + '\n\nParagraph';
      // Cursor at start of table (after "# Title\n\n")
      const tableStart = '# Title\n\n'.length;
      createWithContent(content, tableStart + 3);
      const table = parseTable(view.state, tableStart + 3);
      expect(table).not.toBeNull();
      expect(table!.rows[0]).toEqual(['H1', 'H2']);
    });
  });

  describe('addColumn', () => {
    it('should add a column to all rows including header and separator', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5)!;
      addColumn(view, table);

      // Re-parse after modification
      const newTable = parseTable(view.state, 5);
      expect(newTable).not.toBeNull();
      expect(newTable!.rows[0].length).toBe(3); // header now has 3 columns
      expect(newTable!.rows[0][2]).toBe('Header'); // new column header
      expect(newTable!.alignments.length).toBe(3); // separator has 3 entries
      expect(newTable!.rows[2].length).toBe(3); // data row has 3 cells
      expect(newTable!.rows.length).toBe(4); // still 4 rows
    });
  });

  describe('removeColumn', () => {
    it('should remove the specified column', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5)!;
      removeColumn(view, table, 0);
      const text = docText();
      const lines = text.split('\n');
      // Each row should now have 1 column
      for (const line of lines) {
        const parts = line.split('|').filter((s) => s.trim() !== '');
        expect(parts.length).toBe(1);
      }
      // First data cell should be "B" (was column 1)
      expect(lines[2]).toContain('B');
    });

    it('should not remove the last column', () => {
      const oneColTable = [
        '| H1 |',
        '| -- |',
        '| A  |',
      ].join('\n');
      createWithContent(oneColTable, 3);
      const table = parseTable(view.state, 3)!;
      removeColumn(view, table, 0);
      // Should remain unchanged
      expect(docText()).toBe(oneColTable);
    });
  });

  describe('addRow', () => {
    it('should append a new row at the end', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5)!;
      addRow(view, table);

      // Re-parse after modification
      const newTable = parseTable(view.state, 5);
      expect(newTable).not.toBeNull();
      expect(newTable!.rows.length).toBe(5); // was 4, now 5
      // Last row should have the right number of columns with empty cells
      expect(newTable!.rows[4].length).toBe(2);
      expect(newTable!.rows[4][0]).toBe('');
      expect(newTable!.rows[4][1]).toBe('');
    });
  });

  describe('removeRow', () => {
    it('should remove the specified data row', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5)!;
      removeRow(view, table, 2); // remove first data row (row index 2)
      const text = docText();
      const lines = text.split('\n');
      expect(lines.length).toBe(3); // header + separator + 1 data row
      // Remaining data row should contain C and D
      expect(lines[2]).toContain('C');
      expect(lines[2]).toContain('D');
    });

    it('should not remove the header row', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5)!;
      removeRow(view, table, 0);
      // Should remain unchanged
      expect(docText()).toBe(simpleTable);
    });

    it('should not remove the separator row', () => {
      createWithContent(simpleTable, 5);
      const table = parseTable(view.state, 5)!;
      removeRow(view, table, 1);
      // Should remain unchanged
      expect(docText()).toBe(simpleTable);
    });
  });

  describe('alignment preservation', () => {
    it('should preserve alignment when adding a column', () => {
      const alignedTable = [
        '| Left | Right |',
        '| :--- | ----: |',
        '| A    | B     |',
      ].join('\n');
      createWithContent(alignedTable, 5);
      const table = parseTable(view.state, 5)!;
      expect(table.alignments).toEqual(['left', 'right']);
      addColumn(view, table);
      // Re-parse after modification
      const newTable = parseTable(view.state, 5);
      expect(newTable).not.toBeNull();
      expect(newTable!.alignments[0]).toBe('left');
      expect(newTable!.alignments[1]).toBe('right');
      expect(newTable!.alignments[2]).toBe('none');
    });

    it('should preserve center alignment when adding rows', () => {
      const centerTable = [
        '| A   | B   |',
        '| :-: | :-: |',
        '| x   | y   |',
      ].join('\n');
      createWithContent(centerTable, 5);
      const table = parseTable(view.state, 5)!;
      expect(table.alignments).toEqual(['center', 'center']);
      addRow(view, table);
      const newTable = parseTable(view.state, 5);
      expect(newTable).not.toBeNull();
      expect(newTable!.alignments).toEqual(['center', 'center']);
      expect(newTable!.rows.length).toBe(4);
    });
  });
});
