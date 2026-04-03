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

describe('inline decorations', () => {
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

  describe('bold', () => {
    it('should apply .cm-bold class to **text** when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: 'normal **bold** normal\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const boldElements = container.querySelectorAll('.cm-bold');
      expect(boldElements.length).toBeGreaterThan(0);
    });

    it('should NOT apply .cm-bold when cursor is on the same line', () => {
      view = createEditor({
        parent: container,
        content: '**bold text**\n\nother line',
      });
      moveCursorToLine(view, 1);

      const boldElements = container.querySelectorAll('.cm-bold');
      expect(boldElements.length).toBe(0);
    });

    it('should hide ** markers when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: '**bold**\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      // The line containing bold text should not show the ** markers visually
      const lines = container.querySelectorAll('.cm-line');
      const boldLine = lines[0];
      // The bold text should be rendered, but markers should be hidden
      expect(boldLine.textContent).not.toContain('**');
    });
  });

  describe('italic', () => {
    it('should apply .cm-italic class to *text* when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: 'normal *italic* normal\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const italicElements = container.querySelectorAll('.cm-italic');
      expect(italicElements.length).toBeGreaterThan(0);
    });

    it('should NOT apply .cm-italic when cursor is on the same line', () => {
      view = createEditor({
        parent: container,
        content: '*italic text*\n\nother line',
      });
      moveCursorToLine(view, 1);

      const italicElements = container.querySelectorAll('.cm-italic');
      expect(italicElements.length).toBe(0);
    });

    it('should hide * markers when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: '*italic*\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const lines = container.querySelectorAll('.cm-line');
      const italicLine = lines[0];
      expect(italicLine.textContent).not.toContain('*');
    });
  });

  describe('strikethrough', () => {
    it('should apply .cm-strikethrough class to ~~text~~ when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: 'normal ~~strike~~ normal\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const strikeElements = container.querySelectorAll('.cm-strikethrough');
      expect(strikeElements.length).toBeGreaterThan(0);
    });

    it('should NOT apply .cm-strikethrough when cursor is on the same line', () => {
      view = createEditor({
        parent: container,
        content: '~~strike text~~\n\nother line',
      });
      moveCursorToLine(view, 1);

      const strikeElements = container.querySelectorAll('.cm-strikethrough');
      expect(strikeElements.length).toBe(0);
    });

    it('should hide ~~ markers when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: '~~strike~~\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const lines = container.querySelectorAll('.cm-line');
      const strikeLine = lines[0];
      expect(strikeLine.textContent).not.toContain('~~');
    });
  });

  describe('nested formatting', () => {
    it('should handle ***bold italic*** text', () => {
      view = createEditor({
        parent: container,
        content: '***bold italic***\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const boldElements = container.querySelectorAll('.cm-bold');
      const italicElements = container.querySelectorAll('.cm-italic');
      expect(boldElements.length).toBeGreaterThan(0);
      expect(italicElements.length).toBeGreaterThan(0);
    });
  });
});
