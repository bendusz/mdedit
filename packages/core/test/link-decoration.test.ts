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

describe('link decorations', () => {
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

  it('should style link text with cm-link class', () => {
    view = createEditor({
      parent: container,
      content: 'Click [here](https://example.com) now\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const linkElements = container.querySelectorAll('.cm-link');
    expect(linkElements.length).toBeGreaterThan(0);
  });

  it('should hide [ and ](url) syntax when cursor is away', () => {
    view = createEditor({
      parent: container,
      content: '[link text](https://example.com)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const lines = container.querySelectorAll('.cm-line');
    const linkLine = lines[0];
    // Only the link text should be visible — brackets and URL hidden
    expect(linkLine.textContent).not.toContain('[');
    expect(linkLine.textContent).not.toContain(']');
    expect(linkLine.textContent).not.toContain('https://example.com');
  });

  it('should show raw markdown when cursor is on the link line', () => {
    view = createEditor({
      parent: container,
      content: '[link text](https://example.com)\n\nother line',
    });
    moveCursorToLine(view, 1);

    const linkElements = container.querySelectorAll('.cm-link');
    expect(linkElements.length).toBe(0);

    const lines = container.querySelectorAll('.cm-line');
    const linkLine = lines[0];
    expect(linkLine.textContent).toContain('[link text]');
    expect(linkLine.textContent).toContain('https://example.com');
  });

  it('should handle link with surrounding text', () => {
    view = createEditor({
      parent: container,
      content: 'before [click me](https://test.com) after\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const lines = container.querySelectorAll('.cm-line');
    const linkLine = lines[0];
    // Should show surrounding text and styled link text, but not syntax
    expect(linkLine.textContent).toContain('before');
    expect(linkLine.textContent).toContain('click me');
    expect(linkLine.textContent).toContain('after');
    expect(linkLine.textContent).not.toContain('https://test.com');
  });

  it('should handle multiple links on the same line', () => {
    view = createEditor({
      parent: container,
      content: '[a](https://a.com) and [b](https://b.com)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const linkElements = container.querySelectorAll('.cm-link');
    expect(linkElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should not navigate on click (display only)', () => {
    view = createEditor({
      parent: container,
      content: '[click](https://example.com)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    // Links should be styled but not be actual <a> elements
    const anchorElements = container.querySelectorAll('a[href]');
    expect(anchorElements.length).toBe(0);
  });
});
