import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export interface TableInfo {
  /** Document offset where the table starts. */
  from: number;
  /** Document offset where the table ends. */
  to: number;
  /** Parsed rows: rows[0] is the header, rows[1] is the separator, rows[2..] are data rows. */
  rows: string[][];
  /** Column alignments derived from the separator row: 'left' | 'center' | 'right' | 'none'. */
  alignments: string[];
  /** Index of the header row (always 0 in a standard GFM table). */
  headerRow: number;
}

/**
 * Parse the alignment from a separator cell like `---`, `:---`, `:---:`, `---:`.
 */
function parseAlignment(cell: string): string {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return 'none';
}

/**
 * Parse a single table row string into an array of cell contents (trimmed).
 * Handles leading/trailing pipes: `| a | b |` -> ['a', 'b'].
 */
function parseRow(line: string): string[] {
  // Remove leading/trailing pipe and whitespace
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

/**
 * Build a separator cell for the given alignment and width.
 */
function separatorCell(alignment: string, width: number): string {
  const dashes = Math.max(width, 3);
  switch (alignment) {
    case 'center':
      return ':' + '-'.repeat(dashes - 2) + ':';
    case 'right':
      return '-'.repeat(dashes - 1) + ':';
    case 'left':
      return ':' + '-'.repeat(dashes - 1);
    default:
      return '-'.repeat(dashes);
  }
}

/**
 * Reconstruct a markdown table string from rows and alignments.
 */
function serializeTable(rows: string[][], alignments: string[]): string {
  const colCount = alignments.length;

  // Calculate max width per column
  const colWidths: number[] = new Array(colCount).fill(3);
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const cell = row[c] ?? '';
      colWidths[c] = Math.max(colWidths[c], cell.length);
    }
  }

  const lines: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    if (r === 1) {
      // Separator row
      const cells = alignments.map((a, c) => separatorCell(a, colWidths[c]));
      lines.push('| ' + cells.join(' | ') + ' |');
    } else {
      // Pad the row to colCount so short rows don't produce malformed tables
      const cells = Array.from({ length: colCount }, (_, c) => {
        const cell = rows[r][c] ?? '';
        const w = colWidths[c] ?? cell.length;
        return cell.padEnd(w);
      });
      lines.push('| ' + cells.join(' | ') + ' |');
    }
  }

  return lines.join('\n');
}

/**
 * Find and parse the GFM table at the given cursor position.
 * Returns null if the cursor is not inside a Table node.
 */
export function parseTable(state: EditorState, pos: number): TableInfo | null {
  let tableNode: { from: number; to: number } | null = null;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'Table') {
        if (pos >= node.from && pos <= node.to) {
          tableNode = { from: node.from, to: node.to };
        }
        return false;
      }
    },
  });

  if (!tableNode) return null;

  const { from, to } = tableNode;
  const text = state.doc.sliceString(from, to);
  // Filter blank lines to guard against trailing newlines in the sliced text
  const lines = text.split('\n').filter((l) => l.trim() !== '');

  if (lines.length < 2) return null;

  const rows = lines.map(parseRow);

  // Row 1 (index 1) is the separator row — parse alignments from it
  const alignments = rows[1].map(parseAlignment);

  return {
    from,
    to,
    rows,
    alignments,
    headerRow: 0,
  };
}

/**
 * Add a column at the end of the table.
 */
export function addColumn(view: EditorView, table: TableInfo): void {
  const newRows = table.rows.map((row, i) => {
    if (i === 0) return [...row, 'Header'];
    if (i === 1) return [...row, '---'];
    return [...row, ''];
  });
  const newAlignments = [...table.alignments, 'none'];

  const newText = serializeTable(newRows, newAlignments);
  view.dispatch({
    changes: { from: table.from, to: table.to, insert: newText },
  });
}

/**
 * Remove a column at the specified index.
 */
export function removeColumn(
  view: EditorView,
  table: TableInfo,
  colIndex: number,
): void {
  if (colIndex < 0 || colIndex >= table.alignments.length) return;
  // Don't remove if it's the last column
  if (table.alignments.length <= 1) return;

  const newRows = table.rows.map((row) => row.filter((_, c) => c !== colIndex));
  const newAlignments = table.alignments.filter((_, c) => c !== colIndex);

  const newText = serializeTable(newRows, newAlignments);
  view.dispatch({
    changes: { from: table.from, to: table.to, insert: newText },
  });
}

/**
 * Add a row at the end of the table.
 */
export function addRow(view: EditorView, table: TableInfo): void {
  const colCount = table.alignments.length;
  const emptyRow = new Array(colCount).fill('');
  const newRows = [...table.rows, emptyRow];

  const newText = serializeTable(newRows, table.alignments);
  view.dispatch({
    changes: { from: table.from, to: table.to, insert: newText },
  });
}

/**
 * Remove a row at the specified index. Cannot remove the header (row 0) or separator (row 1).
 */
export function removeRow(
  view: EditorView,
  table: TableInfo,
  rowIndex: number,
): void {
  // Cannot remove header row (0) or separator row (1)
  if (rowIndex <= 1) return;
  if (rowIndex >= table.rows.length) return;

  const newRows = table.rows.filter((_, r) => r !== rowIndex);

  const newText = serializeTable(newRows, table.alignments);
  view.dispatch({
    changes: { from: table.from, to: table.to, insert: newText },
  });
}
