import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { clearMathCache } from '../src/extensions/math-widget';

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
 * Move cursor to a specific position and flush so decorations recompute.
 */
function moveCursorToPos(view: EditorView, pos: number) {
  view.dispatch({ selection: { anchor: pos } });
  flushEditorUpdate(view);
}

describe('inline math detection ($...$)', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearMathCache();
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should render inline math widget for $E=mc^2$', () => {
    view = createEditor({
      parent: container,
      content: 'Einstein said $E=mc^2$ is famous.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(1);
    // KaTeX should render some content inside
    const katexEl = widgets[0].querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('should render multiple inline math expressions', () => {
    view = createEditor({
      parent: container,
      content: 'We have $a^2$ and $b^2$ here.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(2);
  });

  it('should not treat $100 as math (space after opening $)', () => {
    view = createEditor({
      parent: container,
      content: 'The price is $100 today.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    // "$100" has no closing $, so it should not be detected as math
    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
  });

  it('should not treat "$ 100$" as math (space after opening $)', () => {
    view = createEditor({
      parent: container,
      content: 'Amount: $ 100$ is wrong.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
  });

  it('should not treat "$100 $" as math (space before closing $)', () => {
    view = createEditor({
      parent: container,
      content: 'Amount: $100 $ is wrong.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
  });

  it('should show raw LaTeX when cursor is on the math line', () => {
    view = createEditor({
      parent: container,
      content: 'Einstein said $E=mc^2$ is famous.\n\ncursor here',
    });

    // Move cursor to the line with math
    moveCursorToLine(view, 1);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
  });

  it('should show widget when cursor moves away from math line', () => {
    view = createEditor({
      parent: container,
      content: 'Einstein said $E=mc^2$ is famous.\n\ncursor here',
    });

    // Cursor on math line — no widget
    moveCursorToLine(view, 1);
    expect(container.querySelectorAll('.cm-math-inline').length).toBe(0);

    // Move cursor away — widget appears
    moveCursorToLine(view, 3);
    expect(container.querySelectorAll('.cm-math-inline').length).toBe(1);
  });

  it('should handle escaped dollar signs (\\$)', () => {
    view = createEditor({
      parent: container,
      content: 'Cost is \\$50 and \\$100.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
  });
});

describe('display math detection ($$...$$)', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearMathCache();
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should render display math widget for $$...$$', () => {
    view = createEditor({
      parent: container,
      content: '$$\\sum_{i=1}^n i$$\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(1);
    const katexEl = widgets[0].querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('should render multiline display math', () => {
    view = createEditor({
      parent: container,
      content: '$$\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n$$\n\ncursor here',
    });
    moveCursorToLine(view, 5);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(1);
  });

  it('should show raw LaTeX when cursor is inside display math block', () => {
    view = createEditor({
      parent: container,
      content: '$$\n\\sum_{i=1}^n i\n$$\n\ncursor here',
    });

    // Move cursor to the content line of display math
    moveCursorToLine(view, 2);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(0);
  });

  it('should show raw LaTeX when cursor is on opening $$', () => {
    view = createEditor({
      parent: container,
      content: '$$\n\\sum_{i=1}^n i\n$$\n\ncursor here',
    });

    moveCursorToLine(view, 1);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(0);
  });

  it('should show raw LaTeX when cursor is on closing $$', () => {
    view = createEditor({
      parent: container,
      content: '$$\n\\sum_{i=1}^n i\n$$\n\ncursor here',
    });

    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(0);
  });

  it('should handle multiple display math blocks', () => {
    const content = [
      '$$x^2 + y^2 = z^2$$',
      '',
      '$$a^2 + b^2 = c^2$$',
      '',
      'cursor here',
    ].join('\n');
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(2);
  });

  it('should NOT treat mid-line $$...$$ as display math', () => {
    view = createEditor({
      parent: container,
      content: 'some text $$x^2$$ more text\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    // $$...$$ mid-paragraph must not produce a display math widget
    const displayWidgets = container.querySelectorAll('.cm-math-display');
    expect(displayWidgets.length).toBe(0);
  });

  it('should NOT treat $$...$$ preceded by whitespace mid-line as display math', () => {
    view = createEditor({
      parent: container,
      content: 'prefix  $$x^2$$\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const displayWidgets = container.querySelectorAll('.cm-math-display');
    expect(displayWidgets.length).toBe(0);
  });
});

describe('math inside code blocks', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearMathCache();
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should not treat $ inside fenced code blocks as math', () => {
    const content = [
      '```',
      'let price = $100;',
      'let tax = $20;',
      '```',
      '',
      'cursor here',
    ].join('\n');
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 6);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
    const displayWidgets = container.querySelectorAll('.cm-math-display');
    expect(displayWidgets.length).toBe(0);
  });

  it('should not treat $ inside inline code as math', () => {
    view = createEditor({
      parent: container,
      content: 'Use `$variable` in bash.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(0);
  });

  it('should not treat $$ inside code blocks as math', () => {
    const content = [
      '```bash',
      'echo $$',
      '```',
      '',
      'cursor here',
    ].join('\n');
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 5);

    const displayWidgets = container.querySelectorAll('.cm-math-display');
    expect(displayWidgets.length).toBe(0);
  });
});

describe('math error handling', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearMathCache();
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should handle invalid LaTeX gracefully for inline math', () => {
    view = createEditor({
      parent: container,
      content: '$\\invalid{command$\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    // KaTeX with throwOnError: false renders errors as colored text
    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(1);
    // Should still render something (KaTeX error output)
    expect(widgets[0].textContent).not.toBe('');
  });

  it('should handle invalid LaTeX gracefully for display math', () => {
    view = createEditor({
      parent: container,
      content: '$$\\invalid{command$$\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(1);
    expect(widgets[0].textContent).not.toBe('');
  });
});

describe('math edge cases', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearMathCache();
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should handle inline math with complex expressions', () => {
    view = createEditor({
      parent: container,
      content: 'The formula $\\frac{a}{b}$ is a fraction.\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-inline');
    expect(widgets.length).toBe(1);
    const katexEl = widgets[0].querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('should handle display math with aligned equations', () => {
    view = createEditor({
      parent: container,
      content: '$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(1);
    const katexEl = widgets[0].querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('should not treat empty $$ as display math', () => {
    view = createEditor({
      parent: container,
      content: '$$$$ should not be math\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    // $$$$ with nothing between them — empty display math should not render
    const widgets = container.querySelectorAll('.cm-math-display');
    expect(widgets.length).toBe(0);
  });

  it('should handle both inline and display math in the same document', () => {
    const content = [
      'Inline: $E=mc^2$',
      '',
      'Display:',
      '$$\\int_0^1 x^2 dx$$',
      '',
      'cursor here',
    ].join('\n');
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 6);

    const inlineWidgets = container.querySelectorAll('.cm-math-inline');
    expect(inlineWidgets.length).toBe(1);

    const displayWidgets = container.querySelectorAll('.cm-math-display');
    expect(displayWidgets.length).toBe(1);
  });
});
