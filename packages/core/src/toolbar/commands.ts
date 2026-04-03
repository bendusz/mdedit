import { EditorView } from '@codemirror/view';

function canEdit(view: EditorView): boolean {
  return !view.state.readOnly;
}

/**
 * Helper: wrap the current selection with `before` and `after` markers.
 * If already wrapped, unwrap. If no selection, insert `before + placeholder + after`
 * with the placeholder selected.
 */
function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholder: string,
) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    // Check if already wrapped — unwrap
    const docText = view.state.doc.toString();
    const preceding = docText.slice(Math.max(0, from - before.length), from);
    const following = docText.slice(to, to + after.length);
    if (preceding === before && following === after) {
      // Guard against false matches: for `*` (italic), don't unwrap if the
      // surrounding chars are actually `**` (bold). Check the char just outside.
      const outerBefore = from - before.length - 1;
      const outerAfter = to + after.length;
      const markerChar = before[0];
      const isLongerMarker =
        (outerBefore >= 0 && docText[outerBefore] === markerChar) ||
        (outerAfter < docText.length && docText[outerAfter] === markerChar);
      if (!isLongerMarker) {
        view.dispatch({
          changes: [
            { from: from - before.length, to: from, insert: '' },
            { from: to, to: to + after.length, insert: '' },
          ],
        });
        return;
      }
    }
    // Wrap
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: to + before.length },
    });
  } else {
    // No selection — insert placeholder
    const insert = `${before}${placeholder}${after}`;
    view.dispatch({
      changes: { from, insert },
      selection: {
        anchor: from + before.length,
        head: from + before.length + placeholder.length,
      },
    });
  }
}

/** Toggle bold (`**`) around the selection, or insert a bold placeholder. */
export function toggleBold(view: EditorView) {
  if (!canEdit(view)) return;
  wrapSelection(view, '**', '**', 'bold');
}

/** Toggle italic (`*`) around the selection, or insert an italic placeholder. */
export function toggleItalic(view: EditorView) {
  if (!canEdit(view)) return;
  wrapSelection(view, '*', '*', 'italic');
}

/** Toggle strikethrough (`~~`) around the selection, or insert a placeholder. */
export function toggleStrikethrough(view: EditorView) {
  if (!canEdit(view)) return;
  wrapSelection(view, '~~', '~~', 'strikethrough');
}

/** Insert a markdown link. Uses the selection as link text, or inserts a template. */
export function insertLink(view: EditorView) {
  if (!canEdit(view)) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const insert = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert },
      // Select "url" so the user can type the URL immediately
      selection: {
        anchor: from + selected.length + 3,
        head: from + selected.length + 3 + 3,
      },
    });
  } else {
    const insert = '[link text](url)';
    view.dispatch({
      changes: { from, insert },
      // Select "url"
      selection: { anchor: from + 13, head: from + 16 },
    });
  }
}

/** Insert a markdown image. Uses the selection as alt text, or inserts a template. */
export function insertImage(view: EditorView) {
  if (!canEdit(view)) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const insert = `![${selected}](image-url)`;
    view.dispatch({
      changes: { from, to, insert },
      // Select "image-url"
      selection: {
        anchor: from + selected.length + 4,
        head: from + selected.length + 4 + 9,
      },
    });
  } else {
    const insert = '![alt](image-url)';
    view.dispatch({
      changes: { from, insert },
      // Select "image-url"
      selection: { anchor: from + 7, head: from + 16 },
    });
  }
}

/**
 * Set the heading level for the current line. If the line already has a heading
 * prefix, it is replaced. Level 0 removes the heading entirely.
 */
export function setHeading(view: EditorView, level: number) {
  if (!canEdit(view)) return;
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = line.text;

  // Match existing heading prefix: one or more # followed by a space
  const headingMatch = lineText.match(/^(#{1,6})\s/);
  const prefix = level > 0 ? '#'.repeat(level) + ' ' : '';

  if (headingMatch) {
    // Replace existing heading prefix
    const oldPrefix = headingMatch[0];
    view.dispatch({
      changes: {
        from: line.from,
        to: line.from + oldPrefix.length,
        insert: prefix,
      },
    });
  } else {
    // No existing heading — prepend
    view.dispatch({
      changes: { from: line.from, insert: prefix },
    });
  }
}

/** Toggle an unordered list (`- `) prefix on the current line. */
export function toggleList(view: EditorView) {
  if (!canEdit(view)) return;
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = line.text;

  if (lineText.startsWith('- ')) {
    // Remove list prefix
    view.dispatch({
      changes: { from: line.from, to: line.from + 2, insert: '' },
    });
  } else {
    // Add list prefix
    view.dispatch({
      changes: { from: line.from, insert: '- ' },
    });
  }
}

/** Toggle a task list (`- [ ] `) prefix on the current line. */
export function toggleTaskList(view: EditorView) {
  if (!canEdit(view)) return;
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = line.text;

  // Match both unchecked and checked task items
  const taskMatch = lineText.match(/^- \[[ xX]\] /);
  if (taskMatch) {
    // Remove task list prefix (handles - [ ] , - [x] , - [X] )
    view.dispatch({
      changes: { from: line.from, to: line.from + taskMatch[0].length, insert: '' },
    });
  } else if (lineText.startsWith('- ')) {
    // Upgrade plain list to task list: replace "- " with "- [ ] "
    view.dispatch({
      changes: { from: line.from, to: line.from + 2, insert: '- [ ] ' },
    });
  } else {
    // Add task list prefix
    view.dispatch({
      changes: { from: line.from, insert: '- [ ] ' },
    });
  }
}

/** Insert a fenced code block at the cursor, or wrap the selection. */
export function insertCodeBlock(view: EditorView) {
  if (!canEdit(view)) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const insert = `\`\`\`\n${selected}\n\`\`\``;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + 3 },
    });
  } else {
    const insert = '```\n\n```';
    view.dispatch({
      changes: { from, insert },
      // Place cursor on the empty line inside the block
      selection: { anchor: from + 4 },
    });
  }
}

/** Insert a horizontal rule (`---`) on its own line. */
export function insertHorizontalRule(view: EditorView) {
  if (!canEdit(view)) return;
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);

  // If the current line is empty, insert directly; otherwise add a newline first
  let insert: string;
  let cursorPos: number;
  if (line.text.length === 0) {
    insert = '---\n';
    cursorPos = line.from;
  } else {
    insert = '\n---\n';
    // Place cursor on the --- line so live preview reveals the raw markdown
    cursorPos = line.to + 1;
  }

  view.dispatch({
    changes: { from: line.text.length === 0 ? line.from : line.to, insert },
    selection: { anchor: cursorPos },
  });
}

/** Insert a 3-column markdown table template. */
export function insertTable(view: EditorView) {
  if (!canEdit(view)) return;
  const { from } = view.state.selection.main;

  const table = [
    '| Header | Header | Header |',
    '| ------ | ------ | ------ |',
    '| Cell   | Cell   | Cell   |',
    '| Cell   | Cell   | Cell   |',
    '| Cell   | Cell   | Cell   |',
  ].join('\n');

  const line = view.state.doc.lineAt(from);
  let insert: string;
  let tableStart: number;

  if (line.text.length === 0) {
    insert = table + '\n';
    tableStart = line.from;
  } else {
    insert = '\n' + table + '\n';
    tableStart = line.to + 1;
  }

  view.dispatch({
    changes: { from: line.text.length === 0 ? line.from : line.to, insert },
    // Place cursor at the first "Header" text (position 2 within the table: "| H...")
    selection: { anchor: tableStart + 2, head: tableStart + 8 },
  });
}
