import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { clearMermaidCache } from '../src/extensions/mermaid-widget';

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

/**
 * Wait for async rendering (mermaid.render is async).
 */
function waitForRender(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('mermaid code block detection', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearMermaidCache();
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should detect mermaid code blocks in the syntax tree', () => {
    const content = '```mermaid\ngraph TD\n    A --> B\n```\n\nsome text';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    let hasFencedCode = false;
    syntaxTree(view.state).iterate({
      enter(node) {
        if (node.name === 'FencedCode') {
          hasFencedCode = true;
          // Verify the info string contains "mermaid"
          const firstLine = view.state.doc.lineAt(node.from);
          expect(firstLine.text).toContain('mermaid');
        }
      },
    });
    expect(hasFencedCode).toBe(true);
  });

  it('should not affect non-mermaid code blocks', () => {
    const content = '```javascript\nconst x = 1;\n```\n\nsome text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    // Non-mermaid blocks should not have mermaid widgets
    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(0);
  });

  it('should show mermaid widget when cursor is outside the block', () => {
    const content = '```mermaid\ngraph TD\n    A --> B\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 6);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(1);
  });

  it('should not show mermaid widget when cursor is inside the block', () => {
    const content = '```mermaid\ngraph TD\n    A --> B\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 2);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(0);
  });

  it('should not show widget when cursor is on the opening fence line', () => {
    const content = '```mermaid\ngraph TD\n    A --> B\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 1);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(0);
  });

  it('should not show widget when cursor is on the closing fence line', () => {
    const content = '```mermaid\ngraph TD\n    A --> B\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(0);
  });

  it('should show widget again when cursor moves away from the block', () => {
    const content = '```mermaid\ngraph TD\n    A --> B\n```\n\ncursor here';
    view = createEditor({ parent: container, content });

    // Cursor inside block — no widget
    moveCursorToLine(view, 2);
    expect(container.querySelectorAll('.cm-mermaid-widget').length).toBe(0);

    // Move cursor away — widget appears
    moveCursorToLine(view, 6);
    expect(container.querySelectorAll('.cm-mermaid-widget').length).toBe(1);
  });

  it('should handle multiple mermaid blocks', () => {
    const content = [
      '```mermaid',
      'graph TD',
      '    A --> B',
      '```',
      '',
      '```mermaid',
      'graph LR',
      '    C --> D',
      '```',
      '',
      'cursor here',
    ].join('\n');
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 11);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(2);
  });

  it('should not render widget for empty mermaid code blocks', () => {
    const content = '```mermaid\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(0);
  });

  it('should handle mermaid with tilde fences', () => {
    const content = '~~~mermaid\ngraph TD\n    A --> B\n~~~\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 6);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(1);
  });

  it('should handle case-insensitive mermaid info string', () => {
    const content = '```Mermaid\ngraph TD\n    A --> B\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 6);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(1);
  });

  it('should handle render errors gracefully', async () => {
    // Use invalid mermaid syntax
    const content = '```mermaid\nthis is not valid mermaid syntax @@!!##\n```\n\ncursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    // Wait for async mermaid render to complete
    await waitForRender(500);

    const widgets = container.querySelectorAll('.cm-mermaid-widget');
    expect(widgets.length).toBe(1);

    // Should show either an error message or the loading state
    const errorEl = widgets[0].querySelector('.cm-mermaid-error');
    const loadingEl = widgets[0].querySelector('.cm-mermaid-loading');
    // One of these should be present (error after render, loading if render is still pending)
    expect(errorEl !== null || loadingEl !== null).toBe(true);

    if (errorEl) {
      expect(errorEl.textContent).toContain('Mermaid error');
    }
  });
});
