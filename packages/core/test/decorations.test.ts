import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  // Dispatch a no-op selection to trigger an update cycle
  view.dispatch({ selection: { anchor: 0 } });
  // Force the view to measure/sync so decorations apply to the DOM
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

describe('heading decorations', () => {
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

  it('should apply .cm-heading-1 class to H1 lines', () => {
    view = createEditor({ parent: container, content: '# Hello' });
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    const h1Line = lines[0];
    expect(h1Line).toBeDefined();
    expect(h1Line.classList.contains('cm-heading-1')).toBe(true);
  });

  it('should apply different classes for H1 through H6', () => {
    const content = [
      '# Heading 1',
      '## Heading 2',
      '### Heading 3',
      '#### Heading 4',
      '##### Heading 5',
      '###### Heading 6',
    ].join('\n');

    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    expect(lines[0].classList.contains('cm-heading-1')).toBe(true);
    expect(lines[1].classList.contains('cm-heading-2')).toBe(true);
    expect(lines[2].classList.contains('cm-heading-3')).toBe(true);
    expect(lines[3].classList.contains('cm-heading-4')).toBe(true);
    expect(lines[4].classList.contains('cm-heading-5')).toBe(true);
    expect(lines[5].classList.contains('cm-heading-6')).toBe(true);
  });

  it('should NOT apply heading class to plain text lines', () => {
    const content = '# Heading\n\nPlain text';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    // Line 0 is heading, line 1 is blank, line 2 is plain text
    const plainLine = lines[2];
    expect(plainLine).toBeDefined();
    expect(plainLine.classList.contains('cm-heading-1')).toBe(false);
    expect(plainLine.classList.contains('cm-heading-2')).toBe(false);
  });
});
