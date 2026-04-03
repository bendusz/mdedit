import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, setReadOnly } from '../src/editor';
import { EditorView } from '@codemirror/view';

describe('setReadOnly (reading mode)', () => {
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

  it('should make the editor read-only when set to true', () => {
    view = createEditor({ parent: container, content: 'Hello' });
    setReadOnly(view, true);

    expect(view.state.readOnly).toBe(true);
  });

  it('should make the editor non-editable when set to true', () => {
    view = createEditor({ parent: container, content: 'Hello' });
    setReadOnly(view, true);

    // EditorView.editable controls the editable facet value
    expect(view.state.facet(EditorView.editable)).toBe(false);
  });

  it('should restore editability when set back to false', () => {
    view = createEditor({ parent: container, content: 'Hello' });

    setReadOnly(view, true);
    expect(view.state.readOnly).toBe(true);
    expect(view.state.facet(EditorView.editable)).toBe(false);

    setReadOnly(view, false);
    expect(view.state.readOnly).toBe(false);
    expect(view.state.facet(EditorView.editable)).toBe(true);
  });

  it('should preserve content when toggling modes', () => {
    const content = '# Hello\n\nSome **bold** text.';
    view = createEditor({ parent: container, content });

    setReadOnly(view, true);
    expect(view.state.doc.toString()).toBe(content);

    setReadOnly(view, false);
    expect(view.state.doc.toString()).toBe(content);
  });

  it('should report readOnly via state.readOnly', () => {
    view = createEditor({ parent: container, content: 'Hello' });
    expect(view.state.readOnly).toBe(false);

    setReadOnly(view, true);
    expect(view.state.readOnly).toBe(true);

    setReadOnly(view, false);
    expect(view.state.readOnly).toBe(false);
  });

  it('should accept edits after exiting read-only mode', () => {
    view = createEditor({ parent: container, content: 'Hello' });
    setReadOnly(view, true);
    setReadOnly(view, false);

    view.dispatch({ changes: { from: 5, insert: ' world' } });
    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('should allow toggling multiple times without issues', () => {
    view = createEditor({ parent: container, content: 'Test' });

    for (let i = 0; i < 5; i++) {
      setReadOnly(view, true);
      expect(view.state.readOnly).toBe(true);
      expect(view.state.facet(EditorView.editable)).toBe(false);

      setReadOnly(view, false);
      expect(view.state.readOnly).toBe(false);
      expect(view.state.facet(EditorView.editable)).toBe(true);
    }

    expect(view.state.doc.toString()).toBe('Test');
  });

  it('should default to editable state', () => {
    view = createEditor({ parent: container, content: 'Hello' });
    expect(view.state.readOnly).toBe(false);
    expect(view.state.facet(EditorView.editable)).toBe(true);
  });
});
