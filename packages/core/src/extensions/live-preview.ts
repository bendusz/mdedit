import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { headingDecoration } from './heading-decoration';
import { inlineDecoration, inlineStyles } from './inline-decoration';
import { linkDecoration, linkStyles } from './link-decoration';
import { imageDecoration } from './image-widget';
import { codeBlockDecoration, codeBlockStyles } from './code-block';
import { blockquoteDecoration, blockquoteStyles } from './blockquote-decoration';
import { hrDecoration, hrStyles } from './hr-decoration';
import { listDecoration, listStyles } from './list-decoration';
import { tableDecoration, tableStyles } from './table-decoration';
import { frontmatterDecoration, frontmatterStyles } from './frontmatter-decoration';

export { headingDecoration } from './heading-decoration';
export { inlineDecoration, inlineStyles } from './inline-decoration';
export { linkDecoration, linkStyles } from './link-decoration';
export { imageDecoration } from './image-widget';
export { codeBlockDecoration, codeBlockStyles } from './code-block';
export { blockquoteDecoration, blockquoteStyles } from './blockquote-decoration';
export { hrDecoration, hrStyles } from './hr-decoration';
export { listDecoration, listStyles } from './list-decoration';
export { tableDecoration, tableStyles } from './table-decoration';
export { frontmatterDecoration, frontmatterStyles } from './frontmatter-decoration';
export { FrontmatterExtension } from './frontmatter-parser';

const headingStyles = EditorView.baseTheme({
  '.cm-heading-1': { fontSize: '2em', fontWeight: '700', lineHeight: '1.2' },
  '.cm-heading-2': { fontSize: '1.6em', fontWeight: '700', lineHeight: '1.25' },
  '.cm-heading-3': { fontSize: '1.35em', fontWeight: '600', lineHeight: '1.3' },
  '.cm-heading-4': { fontSize: '1.15em', fontWeight: '600', lineHeight: '1.35' },
  '.cm-heading-5': { fontSize: '1.05em', fontWeight: '600', lineHeight: '1.4' },
  '.cm-heading-6': { fontSize: '1em', fontWeight: '600', lineHeight: '1.4' },
});

/** Returns all live-preview extensions (heading decorations, styles, etc.). */
export function livePreview(): Extension[] {
  return [
    headingDecoration,
    headingStyles,
    inlineDecoration,
    inlineStyles,
    linkDecoration,
    linkStyles,
    imageDecoration,
    codeBlockDecoration,
    codeBlockStyles,
    blockquoteDecoration,
    blockquoteStyles,
    hrDecoration,
    hrStyles,
    listDecoration,
    listStyles,
    tableDecoration,
    tableStyles,
    frontmatterDecoration,
    frontmatterStyles,
  ];
}
