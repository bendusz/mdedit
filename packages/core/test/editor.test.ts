import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';

describe('createEditor', () => {
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

  it('should create an EditorView mounted in the container', () => {
    view = createEditor({ parent: container, content: '' });
    expect(view).toBeInstanceOf(EditorView);
    expect(container.querySelector('.cm-editor')).not.toBeNull();
  });

  it('should initialize with provided content', () => {
    const content = '# Hello World\n\nSome text.';
    view = createEditor({ parent: container, content });
    expect(view.state.doc.toString()).toBe(content);
  });

  it('should call onDocChange when content changes', () => {
    let changed = '';
    view = createEditor({
      parent: container,
      content: 'hello',
      onDocChange: (c) => { changed = c; },
    });
    view.dispatch({ changes: { from: 5, insert: ' world' } });
    expect(changed).toBe('hello world');
  });
});
