import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';
import { replaceEmojiShortcodes } from './extensions/emoji';
import { parseAdmonitionType } from './extensions/admonition-decoration';

const htmlTemplate = (body: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exported Document</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
    font-size: 16px;
    line-height: 1.6;
    color: #24292e;
    background-color: #fff;
    margin: 0;
    padding: 0;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }

  h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
  h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  h5 { font-size: 0.875em; }
  h6 { font-size: 0.85em; color: #6a737d; }

  p { margin-top: 0; margin-bottom: 16px; }

  a { color: #0366d6; text-decoration: none; }
  a:hover { text-decoration: underline; }

  strong { font-weight: 600; }

  blockquote {
    margin: 0 0 16px 0;
    padding: 0 1em;
    color: #6a737d;
    border-left: 0.25em solid #dfe2e5;
  }

  code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(27, 31, 35, 0.05);
    border-radius: 3px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  }

  pre {
    margin-top: 0;
    margin-bottom: 16px;
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
  }

  pre code {
    padding: 0;
    margin: 0;
    font-size: 100%;
    background-color: transparent;
    border-radius: 0;
  }

  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: #e1e4e8;
    border: 0;
  }

  ul, ol {
    margin-top: 0;
    margin-bottom: 16px;
    padding-left: 2em;
  }

  li + li { margin-top: 0.25em; }

  table {
    border-spacing: 0;
    border-collapse: collapse;
    margin-top: 0;
    margin-bottom: 16px;
    width: auto;
    overflow: auto;
  }

  table th, table td {
    padding: 6px 13px;
    border: 1px solid #dfe2e5;
  }

  table th {
    font-weight: 600;
    background-color: #f6f8fa;
  }

  table tr:nth-child(2n) { background-color: #f6f8fa; }

  img { max-width: 100%; box-sizing: border-box; }

  del { text-decoration: line-through; }

  /* Footnotes */
  .footnotes {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e1e4e8;
    font-size: 0.875em;
    color: #57606a;
  }

  .footnotes ol {
    padding-left: 1.5em;
  }

  .footnotes li {
    margin-bottom: 8px;
  }

  sup a {
    color: #0366d6;
    text-decoration: none;
    font-weight: 600;
  }

  sup a:hover {
    text-decoration: underline;
  }

  .footnote-backref {
    color: #0366d6;
    text-decoration: none;
    margin-left: 4px;
  }

  input[type="checkbox"] {
    margin: 0 0.2em 0.25em -1.4em;
    vertical-align: middle;
  }

  .task-list-item {
    list-style-type: none;
  }

  /* Admonitions / Callouts */
  .admonition {
    margin: 0 0 16px 0;
    padding: 12px 16px;
    border-left: 4px solid;
    border-radius: 4px;
  }

  .admonition-title {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .admonition-blue { border-left-color: #3b82f6; background-color: rgba(59, 130, 246, 0.08); }
  .admonition-blue .admonition-title { color: #2563eb; }

  .admonition-green { border-left-color: #22c55e; background-color: rgba(34, 197, 94, 0.08); }
  .admonition-green .admonition-title { color: #16a34a; }

  .admonition-purple { border-left-color: #8b5cf6; background-color: rgba(139, 92, 246, 0.08); }
  .admonition-purple .admonition-title { color: #7c3aed; }

  .admonition-amber { border-left-color: #f59e0b; background-color: rgba(245, 158, 11, 0.08); }
  .admonition-amber .admonition-title { color: #d97706; }

  .admonition-red { border-left-color: #ef4444; background-color: rgba(239, 68, 68, 0.08); }
  .admonition-red .admonition-title { color: #dc2626; }

  .admonition-yellow { border-left-color: #eab308; background-color: rgba(234, 179, 8, 0.08); }
  .admonition-yellow .admonition-title { color: #ca8a04; }

  .admonition-gray { border-left-color: #6b7280; background-color: rgba(107, 114, 128, 0.08); }
  .admonition-gray .admonition-title { color: #4b5563; }

  /* Print-optimized styles */
  @media print {
    body {
      background-color: #fff;
      color: #000;
      font-size: 12pt;
    }

    .container {
      max-width: none;
      margin: 0;
      padding: 0;
    }

    a {
      color: #000;
      text-decoration: underline;
    }

    a[href^="http"]::after, a[href^="https"]::after {
      content: " (" attr(href) ")";
      font-size: 0.85em;
      color: #555;
    }

    pre {
      background-color: #f6f8fa !important;
      border: 1px solid #ddd;
      white-space: pre-wrap;
      word-wrap: break-word;
      page-break-inside: avoid;
    }

    code {
      background-color: #f0f0f0 !important;
    }

    blockquote {
      border-left-color: #999;
      color: #333;
    }

    table th {
      background-color: #f0f0f0 !important;
    }

    table tr:nth-child(2n) {
      background-color: transparent !important;
    }

    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }

    h1 { border-bottom-color: #ccc; }
    h2 { border-bottom-color: #ccc; }

    img {
      max-width: 100% !important;
      page-break-inside: avoid;
    }

    hr {
      background-color: #ccc;
    }
  }
</style>
</head>
<body>
<div class="container">
${body}
</div>
</body>
</html>`;

/** Color class mapping for admonition types in HTML export. */
const admonitionColorMap: Record<string, string> = {
  NOTE: 'blue',
  TIP: 'green',
  IMPORTANT: 'purple',
  WARNING: 'amber',
  CAUTION: 'red',
  INFO: 'blue',
  SUCCESS: 'green',
  QUESTION: 'yellow',
  FAILURE: 'red',
  DANGER: 'red',
  BUG: 'red',
  EXAMPLE: 'purple',
  QUOTE: 'gray',
};

/** Icon mapping for admonition types in HTML export. */
const admonitionIconMap: Record<string, string> = {
  NOTE: '\u2139\uFE0F',
  TIP: '\uD83D\uDCA1',
  IMPORTANT: '\u2757',
  WARNING: '\u26A0\uFE0F',
  CAUTION: '\uD83D\uDED1',
  INFO: '\u2139\uFE0F',
  SUCCESS: '\u2705',
  QUESTION: '\u2753',
  FAILURE: '\u274C',
  DANGER: '\u26A0\uFE0F',
  BUG: '\uD83D\uDC1B',
  EXAMPLE: '\uD83D\uDCDD',
  QUOTE: '\u275D',
};

/** Escape special HTML characters to prevent XSS in exported output. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Pre-process markdown to convert `> [!TYPE]` callout blocks into styled
 * HTML div blocks before passing to Marked. This prevents Marked from
 * rendering them as plain blockquotes.
 */
export function preprocessAdmonitions(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const headerMatch = /^>\s*\[!(\w+)\]\s*(.*)$/.exec(lines[i]);
    if (headerMatch) {
      const rawType = headerMatch[1];
      const admonitionType = parseAdmonitionType(rawType);
      if (admonitionType) {
        const colorClass = admonitionColorMap[admonitionType];
        const icon = admonitionIconMap[admonitionType];
        const customTitle = headerMatch[2].trim();
        const label = customTitle
          ? customTitle
          : admonitionType.charAt(0) + admonitionType.slice(1).toLowerCase();

        // Collect all continuation lines (lines starting with `> `)
        const bodyLines: string[] = [];
        i++;
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          // Strip the leading `> ` or `>`
          bodyLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }

        // Emit HTML div block -- body is emitted as markdown after a blank line
        // so Marked renders it properly (e.g. paragraphs, inline formatting).
        result.push('<div class="admonition admonition-' + colorClass + '">');
        result.push('<div class="admonition-title">' + icon + ' ' + escapeHtml(label) + '</div>');
        result.push('');  // blank line for Marked paragraph context
        if (bodyLines.length > 0) {
          result.push(bodyLines.join('\n'));
          result.push('');
        }
        result.push('</div>');
        result.push('');
        continue;
      }
    }

    result.push(lines[i]);
    i++;
  }

  return result.join('\n');
}

/** Create a configured Marked instance with GFM and footnote support. */
function createMarkedInstance(): Marked {
  const instance = new Marked();
  instance.use({ gfm: true, breaks: false });
  instance.use(markedFootnote());
  return instance;
}

/**
 * Convert a markdown string to a complete HTML document.
 *
 * The output is a self-contained HTML file with embedded CSS styling,
 * suitable for viewing in any browser. GFM extensions (tables,
 * strikethrough, task lists) are supported. Admonition callouts
 * (`> [!TYPE]`) are converted to styled div blocks.
 */
export function markdownToHtml(markdown: string): string {
  const instance = createMarkedInstance();
  const withAdmonitions = preprocessAdmonitions(markdown);
  const processed = replaceEmojiShortcodes(withAdmonitions);
  const body = instance.parse(processed, { async: false });
  return htmlTemplate(body);
}
