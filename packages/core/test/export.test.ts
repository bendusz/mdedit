import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../src/export';

describe('markdownToHtml', () => {
  it('should produce a valid HTML document structure', () => {
    const html = markdownToHtml('Hello world');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('should include UTF-8 charset meta tag', () => {
    const html = markdownToHtml('test');
    expect(html).toContain('<meta charset="UTF-8">');
  });

  it('should include a <style> tag with CSS', () => {
    const html = markdownToHtml('test');
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
  });

  it('should wrap content in a container div', () => {
    const html = markdownToHtml('test');
    expect(html).toContain('<div class="container">');
  });

  it('should convert headings correctly', () => {
    const html = markdownToHtml('# Heading 1\n\n## Heading 2\n\n### Heading 3');
    expect(html).toContain('<h1>Heading 1</h1>');
    expect(html).toContain('<h2>Heading 2</h2>');
    expect(html).toContain('<h3>Heading 3</h3>');
  });

  it('should convert bold text', () => {
    const html = markdownToHtml('This is **bold** text');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('should convert italic text', () => {
    const html = markdownToHtml('This is *italic* text');
    expect(html).toContain('<em>italic</em>');
  });

  it('should convert links', () => {
    const html = markdownToHtml('[Example](https://example.com)');
    expect(html).toContain('<a href="https://example.com">Example</a>');
  });

  it('should convert GFM tables', () => {
    const md = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |';
    const html = markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Header 1</th>');
    expect(html).toContain('<td>Cell 1</td>');
    expect(html).toContain('</table>');
  });

  it('should convert GFM strikethrough', () => {
    const html = markdownToHtml('This is ~~deleted~~ text');
    expect(html).toContain('<del>deleted</del>');
  });

  it('should convert GFM task lists', () => {
    const md = '- [x] Done task\n- [ ] Pending task';
    const html = markdownToHtml(md);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
  });

  it('should convert code blocks', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('const x = 1;');
  });

  it('should convert inline code', () => {
    const html = markdownToHtml('Use `console.log()` for debugging');
    expect(html).toContain('<code>console.log()</code>');
  });

  it('should handle empty string input', () => {
    const html = markdownToHtml('');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div class="container">');
    expect(html).toContain('</html>');
  });

  it('should convert blockquotes', () => {
    const html = markdownToHtml('> This is a quote');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('This is a quote');
    expect(html).toContain('</blockquote>');
  });

  it('should convert horizontal rules', () => {
    const html = markdownToHtml('---');
    expect(html).toContain('<hr>');
  });

  it('should convert images', () => {
    const html = markdownToHtml('![Alt text](image.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="image.png"');
    expect(html).toContain('alt="Alt text"');
  });

  it('should convert unordered lists', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    const html = markdownToHtml(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
    expect(html).toContain('</ul>');
  });

  it('should convert ordered lists', () => {
    const md = '1. First\n2. Second\n3. Third';
    const html = markdownToHtml(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('<li>Second</li>');
    expect(html).toContain('</ol>');
  });

  it('should include @media print styles', () => {
    const html = markdownToHtml('# Test');
    expect(html).toContain('@media print');
  });

  it('should include print-specific page-break rules', () => {
    const html = markdownToHtml('test');
    expect(html).toContain('page-break-after: avoid');
    expect(html).toContain('page-break-inside: avoid');
  });

  it('should set print-friendly body styles', () => {
    const html = markdownToHtml('test');
    // Print styles should use pt units for font size
    expect(html).toContain('font-size: 12pt');
  });

  it('should remove container max-width for print', () => {
    const html = markdownToHtml('test');
    expect(html).toContain('max-width: none');
  });
});
