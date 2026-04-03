import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  view.dispatch({ selection: { anchor: 0 } });
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Helper: move cursor to a position and flush.
 */
function setCursorAt(view: EditorView, pos: number) {
  view.dispatch({ selection: { anchor: pos } });
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Helper: collect all syntax tree node names from the document.
 */
function getNodeNames(view: EditorView): string[] {
  const names: string[] = [];
  syntaxTree(view.state).iterate({
    enter(node) {
      names.push(node.name);
    },
  });
  return names;
}

function getFirstNodeText(view: EditorView, target: string): string | null {
  let text: string | null = null;
  syntaxTree(view.state).iterate({
    enter(node) {
      if (text === null && node.name === target) {
        text = view.state.sliceDoc(node.from, node.to);
        return false;
      }
    },
  });
  return text;
}

describe('frontmatter parser', () => {
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

  it('should parse frontmatter at the start of the document', () => {
    const content = '---\ntitle: Hello\ntags: test\n---\n\n# Body';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const names = getNodeNames(view);
    expect(names).toContain('FrontmatterBlock');
    expect(names).toContain('FrontmatterMarker');
    expect(names).toContain('FrontmatterContent');
  });

  it('should NOT parse frontmatter if --- is not at the very start', () => {
    const content = '\n---\ntitle: Hello\n---\n\n# Body';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const names = getNodeNames(view);
    expect(names).not.toContain('FrontmatterBlock');
  });

  it('should NOT parse frontmatter without closing delimiter', () => {
    const content = '---\ntitle: Hello\ntags: test\n\n# Body';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const names = getNodeNames(view);
    expect(names).not.toContain('FrontmatterBlock');
    // Verify the rest of the document is still parsed correctly
    expect(names).toContain('ATXHeading1');
  });

  it('should handle empty frontmatter', () => {
    const content = '---\n---\n\n# Body';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const names = getNodeNames(view);
    expect(names).toContain('FrontmatterBlock');
    expect(names).toContain('FrontmatterMarker');
  });

  it('should parse frontmatter with multiple key-value pairs', () => {
    const content = '---\ntitle: My Post\ndate: 2026-04-03\ntags: [a, b]\ndraft: true\n---\n\nContent here.';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const names = getNodeNames(view);
    expect(names).toContain('FrontmatterBlock');
    expect(names).toContain('FrontmatterContent');
  });

  it('should not treat an indented --- inside YAML content as the closing delimiter', () => {
    const content = '---\ndescription: |\n  ---\n  still yaml\n---\n\n# Body';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const names = getNodeNames(view);
    expect(names).toContain('FrontmatterBlock');
    expect(names).toContain('ATXHeading1');
    expect(getFirstNodeText(view, 'FrontmatterContent')).toContain('still yaml');
  });
});

describe('frontmatter decorations', () => {
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

  it('should apply frontmatter styling classes when cursor is outside', () => {
    const content = '---\ntitle: Hello\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor at end of document (in # Body)
    setCursorAt(view, content.length);

    const lines = container.querySelectorAll('.cm-line');

    // Content line should have frontmatter styling
    const contentLines = container.querySelectorAll('.cm-frontmatter-content');
    expect(contentLines.length).toBeGreaterThan(0);
  });

  it('should hide delimiters when cursor is outside frontmatter', () => {
    const content = '---\ntitle: Hello\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor in the body
    setCursorAt(view, content.length);

    // Delimiter lines should be collapsed
    const delimiterLines = container.querySelectorAll('.cm-frontmatter-delimiter-line');
    expect(delimiterLines.length).toBe(2);
  });

  it('should reveal raw source when cursor is inside frontmatter', () => {
    const content = '---\ntitle: Hello\n---\n\n# Body';
    view = createEditor({ parent: container, content });

    // Place cursor inside frontmatter content (position of 'title')
    setCursorAt(view, 4); // Inside "title: Hello"

    // Should have raw styling, not collapsed delimiters
    const rawLines = container.querySelectorAll('.cm-frontmatter-raw');
    expect(rawLines.length).toBeGreaterThan(0);

    // Delimiter lines should be visible (styled, not collapsed)
    const delimiterLines = container.querySelectorAll('.cm-frontmatter-delimiter');
    expect(delimiterLines.length).toBe(2);

    // Collapsed delimiters should not be present
    const collapsedLines = container.querySelectorAll('.cm-frontmatter-delimiter-line');
    expect(collapsedLines.length).toBe(0);
  });

  it('should apply key-value styling to frontmatter content', () => {
    const content = '---\ntitle: Hello World\nauthor: Ben\n---\n\nBody text';
    view = createEditor({ parent: container, content });

    // Place cursor outside frontmatter
    setCursorAt(view, content.length);

    // Check for key and value decorations
    const keys = container.querySelectorAll('.cm-frontmatter-key');
    const values = container.querySelectorAll('.cm-frontmatter-value');
    expect(keys.length).toBeGreaterThan(0);
    expect(values.length).toBeGreaterThan(0);
  });

  it('should not apply decorations to documents without frontmatter', () => {
    const content = '# Just a heading\n\nSome body text.';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const frontmatterElements = container.querySelectorAll('.cm-frontmatter');
    expect(frontmatterElements.length).toBe(0);
  });

  it('should not apply decorations when --- appears mid-document', () => {
    const content = '# Heading\n\n---\ntitle: Not frontmatter\n---';
    view = createEditor({ parent: container, content });
    flushEditorUpdate(view);

    const frontmatterElements = container.querySelectorAll('.cm-frontmatter');
    expect(frontmatterElements.length).toBe(0);
  });
});
