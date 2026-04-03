import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';
import { getOutline } from '../src/outline';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so the outline can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  view.dispatch({ selection: { anchor: 0 } });
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

describe('getOutline', () => {
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

  it('should return entries for H1 through H6', () => {
    const content = [
      '# Heading 1',
      '## Heading 2',
      '### Heading 3',
      '#### Heading 4',
      '##### Heading 5',
      '###### Heading 6',
    ].join('\n');

    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(6);

    expect(outline[0].level).toBe(1);
    expect(outline[0].text).toBe('Heading 1');

    expect(outline[1].level).toBe(2);
    expect(outline[1].text).toBe('Heading 2');

    expect(outline[2].level).toBe(3);
    expect(outline[2].text).toBe('Heading 3');

    expect(outline[3].level).toBe(4);
    expect(outline[3].text).toBe('Heading 4');

    expect(outline[4].level).toBe(5);
    expect(outline[4].text).toBe('Heading 5');

    expect(outline[5].level).toBe(6);
    expect(outline[5].text).toBe('Heading 6');
  });

  it('should return correct positions for headings', () => {
    const content = '# First\n\nSome text\n\n## Second';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(2);

    expect(outline[0].from).toBe(0);
    expect(outline[0].to).toBe(7); // '# First'.length

    expect(outline[1].from).toBe(20); // after '# First\n\nSome text\n\n'
    expect(outline[1].to).toBe(29); // '## Second'.length from that offset
  });

  it('should return empty array for empty document', () => {
    view = createEditor({ parent: container, content: '' });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toEqual([]);
  });

  it('should return empty array for document with no headings', () => {
    const content = 'Just some text.\n\nAnother paragraph.\n\n- A list item';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toEqual([]);
  });

  it('should not treat frontmatter --- as headings', () => {
    const content = '---\ntitle: Hello\ntags: test\n---\n\n# Real Heading';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(1);
    expect(outline[0].level).toBe(1);
    expect(outline[0].text).toBe('Real Heading');
  });

  it('should handle headings with inline formatting', () => {
    const content = '# **Bold** heading\n\n## A *italic* title';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(2);
    // Text includes the raw markdown for inline formatting
    expect(outline[0].text).toBe('**Bold** heading');
    expect(outline[1].text).toBe('A *italic* title');
  });

  it('should handle headings interspersed with other content', () => {
    const content = [
      '# Introduction',
      '',
      'Some introductory text.',
      '',
      '## Background',
      '',
      'More text here.',
      '',
      '## Methods',
      '',
      '### Experiment 1',
      '',
      'Details...',
    ].join('\n');

    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(4);
    expect(outline.map(e => e.text)).toEqual([
      'Introduction',
      'Background',
      'Methods',
      'Experiment 1',
    ]);
    expect(outline.map(e => e.level)).toEqual([1, 2, 2, 3]);
  });

  it('should handle heading with no text after marks', () => {
    const content = '#\n\n## \n\n### Real heading';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    // The parser may or may not recognize bare # as a heading depending on Lezer
    // but ### Real heading should always be there
    const realHeading = outline.find(e => e.text === 'Real heading');
    expect(realHeading).toBeDefined();
    expect(realHeading!.level).toBe(3);
  });

  it('should handle setext-style headings', () => {
    const content = 'Setext H1\n=========\n\nSetext H2\n---------\n\n# ATX H1';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(3);
    expect(outline[0].text).toBe('Setext H1');
    expect(outline[0].level).toBe(1);
    expect(outline[1].text).toBe('Setext H2');
    expect(outline[1].level).toBe(2);
    expect(outline[2].text).toBe('ATX H1');
    expect(outline[2].level).toBe(1);
  });

  it('should strip trailing ATX closing marks', () => {
    const content = '# Title ##\n\n## Section ###';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const outline = getOutline(view.state);
    expect(outline).toHaveLength(2);
    expect(outline[0].text).toBe('Title');
    expect(outline[1].text).toBe('Section');
  });
});
