import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, setContentWidth } from '../src/editor';
import { EditorView } from '@codemirror/view';

/**
 * CM6 themes inject <style> elements with generated class names.
 * In jsdom, inline styles are not applied, so we verify themes by
 * checking the injected style sheet content for the expected CSS value.
 */
function findMaxWidthInStyles(): string | null {
  const styles = document.querySelectorAll('style');
  for (const style of styles) {
    const text = style.textContent ?? '';
    const match = text.match(/max-width:\s*([^;}\s]+)/);
    if (match) return match[1];
  }
  return null;
}

describe('content width', () => {
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

  it('should apply default 80ch width on editor creation', () => {
    view = createEditor({ parent: container, content: '' });
    expect(findMaxWidthInStyles()).toBe('80ch');
  });

  it('should apply custom width from config', () => {
    view = createEditor({ parent: container, content: '', contentWidth: '120ch' });
    expect(findMaxWidthInStyles()).toBe('120ch');
  });

  it('should update width via setContentWidth', () => {
    view = createEditor({ parent: container, content: '' });
    expect(findMaxWidthInStyles()).toBe('80ch');

    setContentWidth(view, '100%');
    expect(findMaxWidthInStyles()).toBe('100%');
  });

  it('should accept px-based width values', () => {
    view = createEditor({ parent: container, content: '', contentWidth: '720px' });
    expect(findMaxWidthInStyles()).toBe('720px');
  });

  it('should allow multiple width changes', () => {
    view = createEditor({ parent: container, content: '' });

    setContentWidth(view, '60ch');
    expect(findMaxWidthInStyles()).toBe('60ch');

    setContentWidth(view, '100ch');
    expect(findMaxWidthInStyles()).toBe('100ch');

    setContentWidth(view, '100%');
    expect(findMaxWidthInStyles()).toBe('100%');
  });
});
