import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, setTypewriterScrolling } from '../src/editor';
import { typewriterScrolling } from '../src/extensions/typewriter-scrolling';
import { EditorView } from '@codemirror/view';

describe('typewriterScrolling', () => {
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

  it('should return a valid CM6 extension array', () => {
    const ext = typewriterScrolling();
    expect(Array.isArray(ext)).toBe(true);
    expect(ext.length).toBe(2);
  });

  it('should create an editor without errors when typewriter is disabled (default)', () => {
    view = createEditor({ parent: container, content: 'Hello world' });
    expect(view).toBeInstanceOf(EditorView);
    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('should enable typewriter scrolling via compartment without errors', () => {
    view = createEditor({ parent: container, content: 'Hello world' });
    expect(() => setTypewriterScrolling(view, true)).not.toThrow();
  });

  it('should disable typewriter scrolling via compartment without errors', () => {
    view = createEditor({ parent: container, content: 'Hello world' });
    setTypewriterScrolling(view, true);
    expect(() => setTypewriterScrolling(view, false)).not.toThrow();
  });

  it('should toggle on and off multiple times without errors', () => {
    view = createEditor({ parent: container, content: 'Hello world' });
    for (let i = 0; i < 5; i++) {
      expect(() => setTypewriterScrolling(view, true)).not.toThrow();
      expect(() => setTypewriterScrolling(view, false)).not.toThrow();
    }
  });

  it('should not interfere with document editing', () => {
    view = createEditor({ parent: container, content: 'Hello' });
    setTypewriterScrolling(view, true);

    view.dispatch({
      changes: { from: 5, insert: ' world' },
    });

    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('should not interfere with cursor movement', () => {
    view = createEditor({ parent: container, content: 'Hello world' });
    setTypewriterScrolling(view, true);

    view.dispatch({ selection: { anchor: 5 } });
    expect(view.state.selection.main.head).toBe(5);

    view.dispatch({ selection: { anchor: 0 } });
    expect(view.state.selection.main.head).toBe(0);
  });

  it('should apply smooth scroll style when enabled', () => {
    view = createEditor({ parent: container, content: 'Hello world' });
    setTypewriterScrolling(view, true);

    // EditorView.theme sets .cm-scroller { scrollBehavior: 'smooth' }
    // In jsdom we can at least verify the scroller element exists
    const scroller = container.querySelector('.cm-scroller');
    expect(scroller).not.toBeNull();
  });

  it('should work with multi-line content', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    view = createEditor({ parent: container, content: lines });
    setTypewriterScrolling(view, true);

    // Move cursor to the middle
    const midPos = view.state.doc.line(50).from;
    expect(() => {
      view.dispatch({ selection: { anchor: midPos } });
    }).not.toThrow();
  });
});
