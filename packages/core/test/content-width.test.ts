import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, setContentWidth } from '../src/editor';
import { EditorView } from '@codemirror/view';

/**
 * CM6 themes inject <style> elements with generated class names.
 * In jsdom, inline styles are not applied, so we verify themes by
 * checking the injected style sheet content for the expected CSS value.
 *
 * We look specifically for rules targeting .cm-content (via the
 * generated class name that follows it) to avoid matching unrelated
 * max-width rules from other extensions (e.g. the command palette).
 */
function findMaxWidthInStyles(): string | null {
  const styles = Array.from(document.querySelectorAll('style'));
  // Scan in reverse so the most recently injected style wins
  for (let i = styles.length - 1; i >= 0; i--) {
    const text = styles[i].textContent ?? '';
    // Match rules for .cm-content (possibly with a generated CM6 class suffix)
    const match = text.match(/\.cm-content[^{]*\{[^}]*max-width:\s*([^;}\s]+)/);
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
