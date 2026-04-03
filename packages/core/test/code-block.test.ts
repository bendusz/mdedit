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

describe('code block decorations', () => {
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

  it('should apply .cm-code-block class to code lines when cursor is inside', () => {
    const content = 'paragraph\n\n```js\nconst x = 1;\n```\n\nafter';
    view = createEditor({ parent: container, content });
    // Place cursor inside the code block (line 4: "const x = 1;")
    moveCursorToLine(view, 4);

    const codeBlockLines = container.querySelectorAll('.cm-code-block');
    expect(codeBlockLines.length).toBeGreaterThan(0);
  });

  it('should hide fence lines when cursor is outside the code block', () => {
    const content = '```js\nconst x = 1;\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    // The opening fence (```js) and closing fence (```) should be hidden
    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);

    // The fence markers should not appear in visible text
    const hasFenceVisible = visibleTexts.some(
      (t) => t !== null && t.includes('```'),
    );
    expect(hasFenceVisible).toBe(false);
  });

  it('should show raw fences when cursor is inside the code block', () => {
    const content = '```js\nconst x = 1;\n```\n\nother';
    view = createEditor({ parent: container, content });
    // Place cursor on the opening fence line
    moveCursorToLine(view, 1);

    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);

    // At least the opening fence should be visible
    const hasFence = visibleTexts.some(
      (t) => t !== null && t.includes('```'),
    );
    expect(hasFence).toBe(true);
  });

  it('should show raw fences when cursor is on the closing fence line', () => {
    const content = '```\nhello\n```\n\nother';
    view = createEditor({ parent: container, content });
    // Place cursor on the closing fence (line 3)
    moveCursorToLine(view, 3);

    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);

    const hasFence = visibleTexts.some(
      (t) => t !== null && t.includes('```'),
    );
    expect(hasFence).toBe(true);
  });

  it('should not apply .cm-code-block to lines outside the code block', () => {
    const content = 'before\n\n```\ncode\n```\n\nafter';
    view = createEditor({ parent: container, content });
    // Cursor inside the block
    moveCursorToLine(view, 4);

    const allLines = container.querySelectorAll('.cm-line');
    // "before" line (line 0 in DOM) should not have the class
    expect(allLines[0].classList.contains('cm-code-block')).toBe(false);
    // "after" line (last in DOM) should not have the class
    const lastLine = allLines[allLines.length - 1];
    expect(lastLine.classList.contains('cm-code-block')).toBe(false);
  });

  it('should handle code block without language identifier', () => {
    const content = '```\nplain code\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    // Fences should be hidden
    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);
    const hasFence = visibleTexts.some(
      (t) => t !== null && t.includes('```'),
    );
    expect(hasFence).toBe(false);
  });

  it('should handle multiple code blocks', () => {
    const content = '```js\nfirst\n```\n\n```py\nsecond\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 9);

    // Both sets of fences should be hidden
    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);
    const hasFence = visibleTexts.some(
      (t) => t !== null && t.includes('```'),
    );
    expect(hasFence).toBe(false);
  });

  it('should show fences only for the block containing the cursor', () => {
    const content = '```js\nfirst\n```\n\n```py\nsecond\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    // Place cursor inside first code block (line 2: "first")
    moveCursorToLine(view, 2);

    const allLines = container.querySelectorAll('.cm-line');
    const visibleTexts = Array.from(allLines).map((l) => l.textContent);

    // First block fences should be visible (cursor inside)
    const hasJsFence = visibleTexts.some(
      (t) => t !== null && t.includes('```js'),
    );
    expect(hasJsFence).toBe(true);

    // Second block fences should be hidden (cursor outside)
    const hasPyFence = visibleTexts.some(
      (t) => t !== null && t.includes('```py'),
    );
    expect(hasPyFence).toBe(false);
  });
});
