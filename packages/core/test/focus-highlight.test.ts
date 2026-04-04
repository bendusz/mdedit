import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, setFocusHighlight } from '../src/editor';
import { EditorView } from '@codemirror/view';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  view.dispatch({ selection: { anchor: view.state.selection.main.head } });
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

describe('focusHighlight', () => {
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

  it('should not add unfocused-line class when focus highlight is disabled', () => {
    const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const unfocusedLines = container.querySelectorAll('.cm-unfocused-line');
    expect(unfocusedLines.length).toBe(0);
  });

  it('should add cm-unfocused-line class to non-cursor paragraphs when enabled', () => {
    const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    view = createEditor({ parent: container, content });

    // Place cursor at the beginning (first paragraph)
    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    const unfocusedLines = container.querySelectorAll('.cm-unfocused-line');
    // Lines: "First paragraph" (focused), "" (blank), "Second paragraph" (unfocused),
    //        "" (blank), "Third paragraph" (unfocused)
    // Blank lines and other paragraphs should be unfocused = 4 lines
    expect(unfocusedLines.length).toBe(4);
  });

  it('should NOT dim lines in the cursor paragraph', () => {
    const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    view = createEditor({ parent: container, content });

    // Place cursor in "First paragraph"
    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    // First line (line 0 in DOM) is "First paragraph" — should NOT be unfocused
    expect(lines[0].classList.contains('cm-unfocused-line')).toBe(false);
  });

  it('should dim lines far from the cursor', () => {
    const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    view = createEditor({ parent: container, content });

    // Place cursor in "First paragraph"
    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    // "Second paragraph" (line index 2) and "Third paragraph" (line index 4) should be unfocused
    expect(lines[2].classList.contains('cm-unfocused-line')).toBe(true);
    expect(lines[4].classList.contains('cm-unfocused-line')).toBe(true);
  });

  it('should update focused paragraph when cursor moves', () => {
    const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    view = createEditor({ parent: container, content });

    // Start at first paragraph
    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    // Now move cursor to "Second paragraph" (position after the two newlines)
    const secondParaStart = content.indexOf('Second');
    view.dispatch({ selection: { anchor: secondParaStart } });
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    // "First paragraph" (index 0) should now be unfocused
    expect(lines[0].classList.contains('cm-unfocused-line')).toBe(true);
    // "Second paragraph" (index 2) should be focused
    expect(lines[2].classList.contains('cm-unfocused-line')).toBe(false);
    // "Third paragraph" (index 4) should be unfocused
    expect(lines[4].classList.contains('cm-unfocused-line')).toBe(true);
  });

  it('should treat multi-line paragraphs as a single block', () => {
    const content = 'Line one\nLine two\nLine three\n\nAnother paragraph';
    view = createEditor({ parent: container, content });

    // Place cursor on "Line two"
    const lineTwoStart = content.indexOf('Line two');
    view.dispatch({ selection: { anchor: lineTwoStart } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    const lines = container.querySelectorAll('.cm-line');
    // Lines 0-2 are "Line one", "Line two", "Line three" — all in cursor paragraph
    expect(lines[0].classList.contains('cm-unfocused-line')).toBe(false);
    expect(lines[1].classList.contains('cm-unfocused-line')).toBe(false);
    expect(lines[2].classList.contains('cm-unfocused-line')).toBe(false);
    // Blank line (index 3) and "Another paragraph" (index 4) should be unfocused
    expect(lines[3].classList.contains('cm-unfocused-line')).toBe(true);
    expect(lines[4].classList.contains('cm-unfocused-line')).toBe(true);
  });

  it('should remove unfocused-line decorations when disabled', () => {
    const content = 'First paragraph\n\nSecond paragraph';
    view = createEditor({ parent: container, content });

    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    // Verify decorations are present
    expect(container.querySelectorAll('.cm-unfocused-line').length).toBeGreaterThan(0);

    // Disable focus highlight
    setFocusHighlight(view, false);
    flushEditorUpdate(view);

    expect(container.querySelectorAll('.cm-unfocused-line').length).toBe(0);
  });

  it('should handle single-line documents', () => {
    const content = 'Just one line';
    view = createEditor({ parent: container, content });

    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    // The only line is the cursor paragraph — nothing should be unfocused
    const unfocusedLines = container.querySelectorAll('.cm-unfocused-line');
    expect(unfocusedLines.length).toBe(0);
  });

  it('should handle empty documents', () => {
    view = createEditor({ parent: container, content: '' });

    view.dispatch({ selection: { anchor: 0 } });
    setFocusHighlight(view, true);
    flushEditorUpdate(view);

    const unfocusedLines = container.querySelectorAll('.cm-unfocused-line');
    expect(unfocusedLines.length).toBe(0);
  });

  it('should toggle on and off multiple times', () => {
    const content = 'Para one\n\nPara two';
    view = createEditor({ parent: container, content });
    view.dispatch({ selection: { anchor: 0 } });

    for (let i = 0; i < 3; i++) {
      setFocusHighlight(view, true);
      flushEditorUpdate(view);
      expect(container.querySelectorAll('.cm-unfocused-line').length).toBeGreaterThan(0);

      setFocusHighlight(view, false);
      flushEditorUpdate(view);
      expect(container.querySelectorAll('.cm-unfocused-line').length).toBe(0);
    }
  });
});
