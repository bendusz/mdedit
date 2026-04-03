import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Move cursor to a specific line (1-based) and flush so decorations recompute.
 */
function moveCursorToLine(view: EditorView, lineNumber: number) {
  const line = view.state.doc.line(lineNumber);
  view.dispatch({ selection: { anchor: line.from } });
  flushEditorUpdate(view);
}

describe('blockquote decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply .cm-blockquote class to blockquote lines', () => {
    const content = '> This is a quote\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 3);

    const blockquoteLines = container.querySelectorAll('.cm-blockquote');
    expect(blockquoteLines.length).toBeGreaterThan(0);
  });

  it('should not apply .cm-blockquote to normal lines', () => {
    const content = '> Quote\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 3);

    const allLines = container.querySelectorAll('.cm-line');
    const lastLine = allLines[allLines.length - 1];
    expect(lastLine.classList.contains('cm-blockquote')).toBe(false);
  });

  it('should apply .cm-blockquote to multi-line blockquotes', () => {
    const content = '> Line one\n> Line two\n\nNormal';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const blockquoteLines = container.querySelectorAll('.cm-blockquote');
    expect(blockquoteLines.length).toBe(2);
  });
});

describe('horizontal rule decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply .cm-hr class to horizontal rule lines', () => {
    const content = 'Above\n\n---\n\nBelow';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    const hrLines = container.querySelectorAll('.cm-hr');
    expect(hrLines.length).toBeGreaterThan(0);
  });

  it('should render HR widget when cursor is not on the line', () => {
    const content = 'Above\n\n---\n\nBelow';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    const hrWidgets = container.querySelectorAll('hr.cm-hr-widget');
    expect(hrWidgets.length).toBe(1);
  });

  it('should show raw marker when cursor is on the HR line', () => {
    const content = 'Above\n\n---\n\nBelow';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 3);

    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);
    const hasRawMarker = visibleTexts.some(
      (t) => t !== null && t.includes('---'),
    );
    expect(hasRawMarker).toBe(true);
  });
});

describe('task list decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply .cm-task-list class to task list items', () => {
    const content = '- [ ] Unchecked task\n- [x] Checked task\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const taskLines = container.querySelectorAll('.cm-task-list');
    expect(taskLines.length).toBe(2);
  });

  it('should not apply .cm-task-list to regular list items', () => {
    const content = '- Regular item\n- [ ] Task item\n\nText';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const taskLines = container.querySelectorAll('.cm-task-list');
    expect(taskLines.length).toBe(1);
  });

  it('should render checkbox widget when cursor is not on the line', () => {
    const content = '- [ ] A task\n\nOther text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 3);

    const checkboxes = container.querySelectorAll('.cm-task-checkbox');
    expect(checkboxes.length).toBe(1);
  });
});

describe('table decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply .cm-table class to table lines', () => {
    const content = '| A | B |\n| - | - |\n| 1 | 2 |\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    const tableLines = container.querySelectorAll('.cm-table');
    expect(tableLines.length).toBe(3);
  });

  it('should not apply .cm-table to non-table lines', () => {
    const content = '| A | B |\n| - | - |\n| 1 | 2 |\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    const allLines = container.querySelectorAll('.cm-line');
    const lastLine = allLines[allLines.length - 1];
    expect(lastLine.classList.contains('cm-table')).toBe(false);
  });
});
