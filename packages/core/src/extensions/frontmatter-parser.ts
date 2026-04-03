import type { BlockParser, MarkdownConfig, Line, BlockContext } from '@lezer/markdown';

/**
 * Custom @lezer/markdown block parser that recognizes YAML frontmatter
 * at the very start of a document. Frontmatter is delimited by lines
 * containing exactly `---`.
 *
 * Produces these syntax tree nodes:
 * - FrontmatterBlock — the entire frontmatter (opening ---, content, closing ---)
 * - FrontmatterMarker — each `---` delimiter line
 * - FrontmatterContent — the YAML content between delimiters
 */

const frontmatterParser: BlockParser = {
  name: 'Frontmatter',
  // Run before all other block parsers so we catch the opening `---` first
  before: 'LinkReference',
  parse(cx: BlockContext, line: Line) {
    // Frontmatter must start at the very beginning of the document
    if (cx.lineStart !== 0) return false;

    // The first line must be exactly `---` (with optional trailing spaces)
    const firstLineText = line.text.trim();
    if (firstLineText !== '---') return false;

    const openStart = cx.lineStart;
    const openEnd = cx.lineStart + line.text.length;

    // Move past the opening delimiter
    if (!cx.nextLine()) return false;

    // Accumulate content lines until we find the closing `---`
    const contentStart = cx.lineStart;
    let contentEnd = contentStart;
    let foundClose = false;
    let closeStart = 0;
    let closeEnd = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const trimmed = line.text.trim();
      if (trimmed === '---') {
        foundClose = true;
        closeStart = cx.lineStart;
        closeEnd = cx.lineStart + line.text.length;
        cx.nextLine(); // Move past the closing delimiter
        break;
      }
      contentEnd = cx.lineStart + line.text.length;
      if (!cx.nextLine()) break;
    }

    // If no closing delimiter found, this is not valid frontmatter
    if (!foundClose) return false;

    // Build the syntax tree elements
    const children = [
      cx.elt('FrontmatterMarker', openStart, openEnd),
    ];

    if (contentEnd > contentStart) {
      children.push(cx.elt('FrontmatterContent', contentStart, contentEnd));
    }

    children.push(cx.elt('FrontmatterMarker', closeStart, closeEnd));

    cx.addElement(cx.elt('FrontmatterBlock', openStart, closeEnd, children));
    return true;
  },
};

/** @lezer/markdown extension that enables YAML frontmatter parsing. */
export const FrontmatterExtension: MarkdownConfig = {
  defineNodes: [
    { name: 'FrontmatterBlock', block: true },
    { name: 'FrontmatterMarker' },
    { name: 'FrontmatterContent' },
  ],
  parseBlock: [frontmatterParser],
};
