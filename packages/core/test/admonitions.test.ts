import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { markdownToHtml, preprocessAdmonitions } from '../src/export';
import { parseAdmonitionType } from '../src/extensions/admonition-decoration';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Move cursor to a specific line (1-based) and flush so decorations recompute.
 */
function moveCursorToLine(view: EditorView, lineNumber: number) {
  const line = view.state.doc.line(lineNumber);
  view.dispatch({ selection: { anchor: line.from } });
  flushEditorUpdate(view);
}

describe('parseAdmonitionType', () => {
  it('should parse NOTE type (uppercase)', () => {
    expect(parseAdmonitionType('NOTE')).toBe('NOTE');
  });

  it('should parse note type (lowercase) case-insensitively', () => {
    expect(parseAdmonitionType('note')).toBe('NOTE');
  });

  it('should parse mixed-case types', () => {
    expect(parseAdmonitionType('Warning')).toBe('WARNING');
    expect(parseAdmonitionType('tIp')).toBe('TIP');
  });

  it('should parse all GitHub alert types', () => {
    expect(parseAdmonitionType('NOTE')).toBe('NOTE');
    expect(parseAdmonitionType('TIP')).toBe('TIP');
    expect(parseAdmonitionType('IMPORTANT')).toBe('IMPORTANT');
    expect(parseAdmonitionType('WARNING')).toBe('WARNING');
    expect(parseAdmonitionType('CAUTION')).toBe('CAUTION');
  });

  it('should parse all Obsidian extra types', () => {
    expect(parseAdmonitionType('INFO')).toBe('INFO');
    expect(parseAdmonitionType('SUCCESS')).toBe('SUCCESS');
    expect(parseAdmonitionType('QUESTION')).toBe('QUESTION');
    expect(parseAdmonitionType('FAILURE')).toBe('FAILURE');
    expect(parseAdmonitionType('DANGER')).toBe('DANGER');
    expect(parseAdmonitionType('BUG')).toBe('BUG');
    expect(parseAdmonitionType('EXAMPLE')).toBe('EXAMPLE');
    expect(parseAdmonitionType('QUOTE')).toBe('QUOTE');
  });

  it('should return null for unknown types', () => {
    expect(parseAdmonitionType('UNKNOWN')).toBeNull();
    expect(parseAdmonitionType('CUSTOM')).toBeNull();
    expect(parseAdmonitionType('')).toBeNull();
  });
});

describe('admonition decorations', () => {
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

  it('should apply .cm-admonition class to NOTE callout lines', () => {
    const content = '> [!NOTE]\n> This is a note.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(2);
  });

  it('should apply the correct color class for NOTE (blue)', () => {
    const content = '> [!NOTE]\n> A note.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const blueLines = container.querySelectorAll('.cm-admonition-blue');
    expect(blueLines.length).toBe(2);
  });

  it('should apply the correct color class for WARNING (amber)', () => {
    const content = '> [!WARNING]\n> Be careful.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const amberLines = container.querySelectorAll('.cm-admonition-amber');
    expect(amberLines.length).toBe(2);
  });

  it('should apply the correct color class for TIP (green)', () => {
    const content = '> [!TIP]\n> A helpful tip.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const greenLines = container.querySelectorAll('.cm-admonition-green');
    expect(greenLines.length).toBe(2);
  });

  it('should apply the correct color class for CAUTION (red)', () => {
    const content = '> [!CAUTION]\n> Danger zone.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const redLines = container.querySelectorAll('.cm-admonition-red');
    expect(redLines.length).toBe(2);
  });

  it('should apply the correct color class for IMPORTANT (purple)', () => {
    const content = '> [!IMPORTANT]\n> Critical info.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const purpleLines = container.querySelectorAll('.cm-admonition-purple');
    expect(purpleLines.length).toBe(2);
  });

  it('should NOT apply .cm-admonition to regular blockquotes', () => {
    const content = '> Just a regular quote.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 3);

    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(0);

    // But it should still have the regular blockquote class
    const blockquoteLines = container.querySelectorAll('.cm-blockquote');
    expect(blockquoteLines.length).toBeGreaterThan(0);
  });

  it('should NOT apply .cm-admonition to normal text', () => {
    const content = '> [!NOTE]\n> A note.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const allLines = container.querySelectorAll('.cm-line');
    const lastLine = allLines[allLines.length - 1];
    expect(lastLine.classList.contains('cm-admonition')).toBe(false);
  });

  it('should render header widget when cursor is outside admonition', () => {
    const content = '> [!NOTE]\n> Some note text.\n\nCursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const headers = container.querySelectorAll('.cm-admonition-header');
    expect(headers.length).toBe(1);
    expect(headers[0].textContent).toContain('Note');
  });

  it('should reveal raw syntax when cursor is inside the admonition', () => {
    const content = '> [!NOTE]\n> Some note text.\n\nCursor here';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 1);

    // No header widget when cursor is inside
    const headers = container.querySelectorAll('.cm-admonition-header');
    expect(headers.length).toBe(0);

    // Raw syntax should be visible
    const lines = container.querySelectorAll('.cm-line');
    const firstLineText = lines[0].textContent;
    expect(firstLineText).toContain('[!NOTE]');
  });

  it('should reveal raw syntax when cursor is on a content line of the admonition', () => {
    const content = '> [!WARNING]\n> Watch out!\n\nSafe text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 2);

    // Since cursor is on line 2 (inside the block), raw syntax should be shown
    const headers = container.querySelectorAll('.cm-admonition-header');
    expect(headers.length).toBe(0);
  });

  it('should handle multi-line admonitions', () => {
    const content = '> [!TIP]\n> Line one.\n> Line two.\n> Line three.\n\nNormal';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 6);

    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(4);
  });

  it('should handle case-insensitive type detection (lowercase)', () => {
    const content = '> [!note]\n> Lowercase note.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(2);
  });

  it('should handle case-insensitive type detection (mixed case)', () => {
    const content = '> [!Warning]\n> Mixed case.\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(2);
  });

  it('should treat text after [!TYPE] as a custom title', () => {
    const content = '> [!NOTE] extra text here\n> Content\n\nNormal';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    // Text after [!TYPE] is now the custom title — still an admonition
    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(2);

    // The header widget should show the custom title
    const headers = container.querySelectorAll('.cm-admonition-header');
    expect(headers.length).toBe(1);
    expect(headers[0].textContent).toContain('extra text here');
  });

  it('should handle single-line admonition (header only, no body)', () => {
    const content = '> [!NOTE]\n\nNormal text';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 3);

    const admonitionLines = container.querySelectorAll('.cm-admonition');
    expect(admonitionLines.length).toBe(1);
  });

  it('should handle BUG type with red color', () => {
    const content = '> [!BUG]\n> Found a bug.\n\nNormal';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const redLines = container.querySelectorAll('.cm-admonition-red');
    expect(redLines.length).toBe(2);
  });

  it('should handle EXAMPLE type with purple color', () => {
    const content = '> [!EXAMPLE]\n> An example.\n\nNormal';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const purpleLines = container.querySelectorAll('.cm-admonition-purple');
    expect(purpleLines.length).toBe(2);
  });

  it('should handle QUOTE type with gray color', () => {
    const content = '> [!QUOTE]\n> A quotation.\n\nNormal';
    view = createEditor({ parent: container, content });
    moveCursorToLine(view, 4);

    const grayLines = container.querySelectorAll('.cm-admonition-gray');
    expect(grayLines.length).toBe(2);
  });
});

describe('preprocessAdmonitions', () => {
  it('should convert NOTE callout to HTML div', () => {
    const md = '> [!NOTE]\n> This is a note.';
    const result = preprocessAdmonitions(md);
    expect(result).toContain('<div class="admonition admonition-blue">');
    expect(result).toContain('Note');
    expect(result).toContain('This is a note.');
    expect(result).toContain('</div>');
  });

  it('should convert WARNING callout to HTML div with amber class', () => {
    const md = '> [!WARNING]\n> Be careful.';
    const result = preprocessAdmonitions(md);
    expect(result).toContain('<div class="admonition admonition-amber">');
    expect(result).toContain('Warning');
  });

  it('should leave regular blockquotes unchanged', () => {
    const md = '> Just a regular quote.';
    const result = preprocessAdmonitions(md);
    expect(result).toBe('> Just a regular quote.');
  });

  it('should handle multi-line callout bodies', () => {
    const md = '> [!TIP]\n> Line one.\n> Line two.';
    const result = preprocessAdmonitions(md);
    expect(result).toContain('Line one.');
    expect(result).toContain('Line two.');
  });

  it('should handle case-insensitive types', () => {
    const md = '> [!note]\n> Lowercase.';
    const result = preprocessAdmonitions(md);
    expect(result).toContain('<div class="admonition admonition-blue">');
    expect(result).toContain('Note');
  });

  it('should handle callout with no body', () => {
    const md = '> [!IMPORTANT]';
    const result = preprocessAdmonitions(md);
    expect(result).toContain('<div class="admonition admonition-purple">');
    expect(result).toContain('Important');
    // Should not contain a <p> if there is no body content
    expect(result).not.toContain('<p>');
  });

  it('should not alter text surrounding a callout', () => {
    const md = 'Before\n\n> [!NOTE]\n> A note.\n\nAfter';
    const result = preprocessAdmonitions(md);
    expect(result).toContain('Before');
    expect(result).toContain('After');
    expect(result).toContain('<div class="admonition admonition-blue">');
  });

  it('should handle unknown types by leaving them as blockquotes', () => {
    const md = '> [!UNKNOWN]\n> Some text.';
    const result = preprocessAdmonitions(md);
    // Should remain as raw blockquote syntax
    expect(result).toContain('> [!UNKNOWN]');
    expect(result).not.toContain('<div class="admonition');
  });
});

describe('admonition HTML export', () => {
  it('should render NOTE callout as styled div in HTML', () => {
    const md = '> [!NOTE]\n> This is a note.';
    const html = markdownToHtml(md);
    expect(html).toContain('admonition');
    expect(html).toContain('admonition-blue');
    expect(html).toContain('Note');
    expect(html).toContain('This is a note.');
  });

  it('should render WARNING callout with amber styling', () => {
    const md = '> [!WARNING]\n> Danger ahead.';
    const html = markdownToHtml(md);
    expect(html).toContain('admonition-amber');
    expect(html).toContain('Warning');
    expect(html).toContain('Danger ahead.');
  });

  it('should render TIP callout with green styling', () => {
    const md = '> [!TIP]\n> Here is a tip.';
    const html = markdownToHtml(md);
    expect(html).toContain('admonition-green');
    expect(html).toContain('Tip');
  });

  it('should render CAUTION callout with red styling', () => {
    const md = '> [!CAUTION]\n> Be very careful.';
    const html = markdownToHtml(md);
    expect(html).toContain('admonition-red');
    expect(html).toContain('Caution');
  });

  it('should render IMPORTANT callout with purple styling', () => {
    const md = '> [!IMPORTANT]\n> Critical information.';
    const html = markdownToHtml(md);
    expect(html).toContain('admonition-purple');
    expect(html).toContain('Important');
  });

  it('should still render regular blockquotes normally', () => {
    const md = '> This is a regular quote.';
    const html = markdownToHtml(md);
    expect(html).toContain('<blockquote>');
    // The body content should not contain an admonition div
    // (note: the <style> section will contain .admonition CSS rules, that's expected)
    expect(html).toContain('This is a regular quote.');
    expect(html).not.toContain('<div class="admonition');
  });

  it('should include admonition CSS styles in exported HTML', () => {
    const md = '> [!NOTE]\n> Test';
    const html = markdownToHtml(md);
    expect(html).toContain('.admonition {');
    expect(html).toContain('.admonition-title');
  });

  it('should handle case-insensitive types in export', () => {
    const md = '> [!warning]\n> Lowercase warning.';
    const html = markdownToHtml(md);
    expect(html).toContain('admonition-amber');
    expect(html).toContain('Warning');
  });

  it('should handle multi-line callout body in export', () => {
    const md = '> [!NOTE]\n> First line.\n> Second line.';
    const html = markdownToHtml(md);
    expect(html).toContain('First line.');
    expect(html).toContain('Second line.');
  });
});
