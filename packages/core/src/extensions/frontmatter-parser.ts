import type { BlockParser, MarkdownConfig, Line, BlockContext } from '@lezer/markdown';
import type { Input } from '@lezer/common';

/**
 * Custom @lezer/markdown block parser that recognizes YAML frontmatter
 * at the very start of a document. Frontmatter is delimited by lines
 * containing exactly `---`.
 *
 * Produces these syntax tree nodes:
 * - FrontmatterBlock — the entire frontmatter (opening ---, content, closing ---)
 * - FrontmatterMarker — each `---` delimiter line
 * - FrontmatterContent — the YAML content between delimiters
 *
 * IMPORTANT: This parser pre-scans the document text to find the closing
 * delimiter BEFORE calling cx.nextLine(). Calling cx.nextLine() and then
 * returning false violates the Lezer block parser contract — consumed lines
 * would vanish from the parse tree.
 */

const frontmatterParser: BlockParser = {
  name: 'Frontmatter',
  // Run before all other block parsers so we catch the opening `---` first
  before: 'LinkReference',
  parse(cx: BlockContext, line: Line) {
    // Frontmatter must start at the very beginning of the document
    if (cx.lineStart !== 0) return false;

    // Delimiters may have trailing whitespace, but must start at column 0.
    if (!isDelimiterLine(line.text)) return false;

    const openStart = cx.lineStart;
    const openEnd = cx.lineStart + line.text.length;

    // Pre-scan: search the document text for a closing `---` without
    // calling cx.nextLine(), which would consume lines irreversibly.
    // BlockContext stores `input` at runtime but the type declarations
    // mark it as private.  Cast to access the underlying Input.
    const input = (cx as unknown as { input: Input }).input;
    const docText = input.read(openEnd, input.length);
    const closingIndex = findClosingDelimiter(docText);
    if (closingIndex === -1) return false;

    // We confirmed a valid frontmatter block exists. Now consume lines
    // with cx.nextLine() to build the tree nodes.
    const contentStart = openEnd + 1; // +1 for the newline after opening ---
    const closeStart = openEnd + closingIndex;
    const closeLine = docText.substring(closingIndex).split('\n')[0];
    const closeEnd = closeStart + closeLine.length;

    // Advance past the opening delimiter
    cx.nextLine();

    // Advance through content and closing delimiter lines
    while (cx.lineStart < closeEnd) {
      if (!cx.nextLine()) break;
    }
    // Move past the closing delimiter line
    cx.nextLine();

    // Build the syntax tree elements
    const children = [
      cx.elt('FrontmatterMarker', openStart, openEnd),
    ];

    // Content exists between the opening delimiter and closing delimiter
    // (excluding the newlines immediately after/before delimiters)
    if (closeStart > contentStart) {
      children.push(cx.elt('FrontmatterContent', contentStart, closeStart - 1));
    }

    children.push(cx.elt('FrontmatterMarker', closeStart, closeEnd));

    cx.addElement(cx.elt('FrontmatterBlock', openStart, closeEnd, children));
    return true;
  },
};

/**
 * Search for a closing `---` delimiter in the text after the opening `---`.
 * Returns the character offset within the text, or -1 if not found.
 * The closing `---` must be on its own line (trimmed).
 */
function findClosingDelimiter(text: string): number {
  let pos = 0;
  while (pos < text.length) {
    // Find next newline to get a line
    const nlIndex = text.indexOf('\n', pos);
    const lineEnd = nlIndex === -1 ? text.length : nlIndex;
    const lineText = text.substring(pos, lineEnd);

    if (isDelimiterLine(lineText)) {
      return pos;
    }

    if (nlIndex === -1) break;
    pos = nlIndex + 1;
  }
  return -1;
}

function isDelimiterLine(text: string): boolean {
  const normalized = text.endsWith('\r') ? text.slice(0, -1) : text;
  return /^---[ \t]*$/.test(normalized);
}

/** @lezer/markdown extension that enables YAML frontmatter parsing. */
export const FrontmatterExtension: MarkdownConfig = {
  defineNodes: [
    { name: 'FrontmatterBlock', block: true },
    { name: 'FrontmatterMarker' },
    { name: 'FrontmatterContent' },
  ],
  parseBlock: [frontmatterParser],
};
