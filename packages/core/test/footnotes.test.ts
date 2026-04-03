import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { markdownToHtml } from '../src/export';

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

describe('footnote decorations', () => {
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

  it('should detect footnote reference [^1] and replace with superscript when cursor is away', () => {
    view = createEditor({
      parent: container,
      content: 'Some text[^1] here\n\n[^1]: Footnote content\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(1);
    // The superscript for "1" is the Unicode superscript character
    expect(refElements[0].textContent).toBe('\u00B9');
  });

  it('should detect footnote definition [^1]: text', () => {
    view = createEditor({
      parent: container,
      content: 'Some text[^1] here\n\n[^1]: Footnote content\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const defElements = container.querySelectorAll('.cm-footnote-def');
    expect(defElements.length).toBe(1);
  });

  it('should NOT treat regular links [text](url) as footnotes', () => {
    view = createEditor({
      parent: container,
      content: 'Click [here](https://example.com) for info\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(0);
  });

  it('should reveal raw [^1] syntax when cursor is on the reference line', () => {
    view = createEditor({
      parent: container,
      content: 'Some text[^1] here\n\n[^1]: Footnote content',
    });
    moveCursorToLine(view, 1);

    // When cursor is on line 1, no footnote-ref widgets should appear on that line
    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(0);

    // The raw syntax should be visible
    const lines = container.querySelectorAll('.cm-line');
    expect(lines[0].textContent).toContain('[^1]');
  });

  it('should reveal raw definition syntax when cursor is on the definition line', () => {
    view = createEditor({
      parent: container,
      content: 'Some text[^1] here\n\n[^1]: Footnote content\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    // The definition line should still have the cm-footnote-def class
    const defElements = container.querySelectorAll('.cm-footnote-def');
    expect(defElements.length).toBe(1);

    // But the def label widget should NOT be present (raw syntax revealed)
    const defLabels = container.querySelectorAll('.cm-footnote-def-label');
    expect(defLabels.length).toBe(0);

    // Raw syntax should be visible
    const lines = container.querySelectorAll('.cm-line');
    const defLine = lines[2]; // third line (index 2)
    expect(defLine.textContent).toContain('[^1]:');
  });

  it('should handle multiple footnotes with different labels', () => {
    view = createEditor({
      parent: container,
      content: 'First[^1] and second[^2] refs\n\n[^1]: First note\n\n[^2]: Second note\n\ncursor here',
    });
    moveCursorToLine(view, 7);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(2);
    expect(refElements[0].textContent).toBe('\u00B9');
    expect(refElements[1].textContent).toBe('\u00B2');
  });

  it('should handle footnotes with text labels like [^note]', () => {
    view = createEditor({
      parent: container,
      content: 'Some text[^note] here\n\n[^note]: A footnote with text label\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(1);
    // Text labels are displayed as-is (not converted to superscript digits)
    expect(refElements[0].textContent).toBe('note');
  });

  it('should style definition line with subtle border', () => {
    view = createEditor({
      parent: container,
      content: 'Text[^1]\n\n[^1]: My footnote\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const defElements = container.querySelectorAll('.cm-footnote-def');
    expect(defElements.length).toBe(1);
  });

  it('should handle multi-digit footnote numbers', () => {
    view = createEditor({
      parent: container,
      content: 'Text[^12] here\n\n[^12]: Footnote twelve\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(1);
    // 12 should be rendered as superscript 1 + superscript 2
    expect(refElements[0].textContent).toBe('\u00B9\u00B2');
  });

  it('should not treat image syntax ![alt](url) as footnote', () => {
    view = createEditor({
      parent: container,
      content: '![alt text](image.png)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(0);
  });

  it('should show def label widget when cursor is away from definition line', () => {
    view = createEditor({
      parent: container,
      content: 'Text[^1]\n\n[^1]: My footnote content\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const defLabels = container.querySelectorAll('.cm-footnote-def-label');
    expect(defLabels.length).toBe(1);
    // The widget should show the superscript label
    expect(defLabels[0].textContent?.trim()).toBe('\u00B9');
  });

  it('should handle footnote reference with hyphenated label', () => {
    view = createEditor({
      parent: container,
      content: 'Text[^my-note] here\n\n[^my-note]: Hyphenated label footnote\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const refElements = container.querySelectorAll('.cm-footnote-ref');
    expect(refElements.length).toBe(1);
    expect(refElements[0].textContent).toBe('my-note');
  });
});

describe('footnote HTML export', () => {
  it('should convert footnote references to superscript links', () => {
    const md = 'Text with a footnote[^1].\n\n[^1]: This is the footnote.';
    const html = markdownToHtml(md);
    expect(html).toContain('footnote');
    // Should contain a superscript reference
    expect(html).toContain('<sup>');
  });

  it('should render footnote definitions in a footnotes section', () => {
    const md = 'Text[^1].\n\n[^1]: Footnote content here.';
    const html = markdownToHtml(md);
    // marked-footnote wraps definitions in a section element with class "footnotes"
    expect(html).toMatch(/<section[^>]*class="footnotes"/);
    expect(html).toContain('Footnote content here');
  });

  it('should handle multiple footnotes in export', () => {
    const md = 'First[^1] and second[^2].\n\n[^1]: Note one.\n\n[^2]: Note two.';
    const html = markdownToHtml(md);
    expect(html).toContain('Note one');
    expect(html).toContain('Note two');
  });

  it('should render footnotes in exported HTML', () => {
    const html = markdownToHtml('Text[^1].\n\n[^1]: Note.');
    expect(html).toMatch(/<section[^>]*class="footnotes"/);
    expect(html).toMatch(/<sup/);
  });
});
