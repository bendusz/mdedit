import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';
import { openSearchPanel } from '@codemirror/search';

describe('search', () => {
  let container: HTMLElement;
  let view: EditorView;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
  afterEach(() => { view?.destroy(); container.remove(); });

  it('should have search extension loaded', () => {
    view = createEditor({ parent: container, content: 'hello world' });
    expect(() => openSearchPanel(view)).not.toThrow();
  });
});
