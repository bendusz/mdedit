import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { parseFrontmatterFields } from '../src/extensions/frontmatter-editor';
import { markdown } from '@codemirror/lang-markdown';
import { FrontmatterExtension } from '../src/extensions/frontmatter-parser';

/**
 * Helper: move cursor to a position and flush.
 */
function setCursorAt(view: EditorView, pos: number) {
  view.dispatch({ selection: { anchor: pos } });
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  view.dispatch({ selection: { anchor: 0 } });
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

describe('parseFrontmatterFields', () => {
  it('should parse simple key-value pairs', () => {
    const doc = '---\ntitle: Hello World\nauthor: Ben\ndate: 2026-04-03\n---';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ extensions: [FrontmatterExtension] })],
    });

    // Content is between the delimiters: lines 2-4 (0-indexed: line numbers 2..4)
    // "title: Hello World" starts at position 4
    const contentFrom = 4; // start of "title: Hello World"
    const contentTo = doc.indexOf('\n---', 4) - 1; // end of last content line

    const fields = parseFrontmatterFields(state, contentFrom, contentTo);

    expect(fields).toHaveLength(3);
    expect(fields[0].key).toBe('title');
    expect(fields[0].value).toBe('Hello World');
    expect(fields[1].key).toBe('author');
    expect(fields[1].value).toBe('Ben');
    expect(fields[2].key).toBe('date');
    expect(fields[2].value).toBe('2026-04-03');
  });

  it('should skip lines without a colon', () => {
    const doc = '---\ntitle: Hello\nno-colon-here\nauthor: Ben\n---';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ extensions: [FrontmatterExtension] })],
    });

    const contentFrom = 4;
    const contentTo = doc.indexOf('\n---', 4) - 1;

    const fields = parseFrontmatterFields(state, contentFrom, contentTo);

    // "no-colon-here" has a colon via the hyphen pattern? No, it does not.
    // Wait — "no-colon-here" has NO colon. It should be skipped.
    // But "no-colon-here" does not contain `:` so it's skipped.
    // Actually let me re-check: colonIndex = text.indexOf(':') => -1, so it's skipped.
    // But the key "no-colon-here" — wait, that's the whole line, no colon.
    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe('title');
    expect(fields[1].key).toBe('author');
  });

  it('should handle values with colons', () => {
    const doc = '---\nurl: https://example.com\ntitle: Hello\n---';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ extensions: [FrontmatterExtension] })],
    });

    const contentFrom = 4;
    const contentTo = doc.indexOf('\n---', 4) - 1;

    const fields = parseFrontmatterFields(state, contentFrom, contentTo);

    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe('url');
    // Value includes everything after the first colon
    expect(fields[0].value).toBe('https://example.com');
  });

  it('should handle empty values', () => {
    const doc = '---\ntitle:\nauthor: Ben\n---';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ extensions: [FrontmatterExtension] })],
    });

    const contentFrom = 4;
    const contentTo = doc.indexOf('\n---', 4) - 1;

    const fields = parseFrontmatterFields(state, contentFrom, contentTo);

    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe('title');
    expect(fields[0].value).toBe('');
    expect(fields[1].key).toBe('author');
    expect(fields[1].value).toBe('Ben');
  });

  it('should skip continuation/nested lines', () => {
    const doc = '---\ntitle: Hello\n  continuation line\nauthor: Ben\n---';
    const state = EditorState.create({
      doc,
      extensions: [markdown({ extensions: [FrontmatterExtension] })],
    });

    const contentFrom = 4;
    const contentTo = doc.indexOf('\n---', 4) - 1;

    const fields = parseFrontmatterFields(state, contentFrom, contentTo);

    // "  continuation line" has spaces in key portion, so it's skipped
    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe('title');
    expect(fields[1].key).toBe('author');
  });
});

describe('frontmatter editor widget', () => {
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

  it('should show widget when cursor is outside frontmatter', () => {
    const content = '---\ntitle: Hello\nauthor: Ben\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor at end of document (in # Body)
    setCursorAt(view, content.length);

    const widget = container.querySelector('.cm-frontmatter-editor');
    expect(widget).not.toBeNull();

    // Should have two rows (title and author)
    const rows = container.querySelectorAll('.cm-frontmatter-editor-row');
    expect(rows.length).toBe(2);

    // Check the keys
    const keys = container.querySelectorAll('.cm-frontmatter-editor-key');
    expect(keys[0].textContent).toBe('title');
    expect(keys[1].textContent).toBe('author');

    // Check the values
    const inputs = container.querySelectorAll<HTMLInputElement>('.cm-frontmatter-editor-value');
    expect(inputs[0].value).toBe('Hello');
    expect(inputs[1].value).toBe('Ben');
  });

  it('should hide widget when cursor is inside frontmatter', () => {
    const content = '---\ntitle: Hello\nauthor: Ben\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor inside frontmatter content
    setCursorAt(view, 4); // Inside "title: Hello"

    const widget = container.querySelector('.cm-frontmatter-editor');
    expect(widget).toBeNull();

    // Should have raw styling from frontmatter-decoration
    const rawLines = container.querySelectorAll('.cm-frontmatter-raw');
    expect(rawLines.length).toBeGreaterThan(0);
  });

  it('should not show widget for documents without frontmatter', () => {
    const content = '# Just a heading\n\nSome body text.';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const widget = container.querySelector('.cm-frontmatter-editor');
    expect(widget).toBeNull();
  });

  it('should not show widget for empty frontmatter', () => {
    const content = '---\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor outside
    setCursorAt(view, content.length);

    const widget = container.querySelector('.cm-frontmatter-editor');
    expect(widget).toBeNull();
  });

  it('should not show widget when --- appears mid-document', () => {
    const content = '# Heading\n\n---\ntitle: Not frontmatter\n---';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const widget = container.querySelector('.cm-frontmatter-editor');
    expect(widget).toBeNull();
  });

  it('should show delimiter styling when cursor is inside frontmatter', () => {
    const content = '---\ntitle: Hello\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor inside frontmatter
    setCursorAt(view, 4);

    // Delimiter lines should be visible with styling
    const delimiterLines = container.querySelectorAll('.cm-frontmatter-delimiter');
    expect(delimiterLines.length).toBe(2);

    // Collapsed delimiters should NOT be present
    const collapsedLines = container.querySelectorAll('.cm-frontmatter-delimiter-line');
    expect(collapsedLines.length).toBe(0);
  });

  it('should handle frontmatter with many fields', () => {
    const content = '---\ntitle: Post\ndate: 2026-04-03\nauthor: Ben\ntags: coding\ndraft: true\n---\n\nContent';
    view = createEditor({ parent: container, content });

    setCursorAt(view, content.length);

    const rows = container.querySelectorAll('.cm-frontmatter-editor-row');
    expect(rows.length).toBe(5);
  });
});
