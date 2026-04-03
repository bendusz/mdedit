import { Marked } from 'marked';

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

  input[type="checkbox"] {
    margin: 0 0.2em 0.25em -1.4em;
    vertical-align: middle;
  }

  .task-list-item {
    list-style-type: none;
  }

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

/** Create a configured Marked instance with GFM support. */
function createMarkedInstance(): Marked {
  const instance = new Marked();
  instance.use({ gfm: true, breaks: false });
  return instance;
}

/**
 * Convert a markdown string to a complete HTML document.
 *
 * The output is a self-contained HTML file with embedded CSS styling,
 * suitable for viewing in any browser. GFM extensions (tables,
 * strikethrough, task lists) are supported.
 */
export function markdownToHtml(markdown: string): string {
  const instance = createMarkedInstance();
  const body = instance.parse(markdown, { async: false });
  return htmlTemplate(body);
}
