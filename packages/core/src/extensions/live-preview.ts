import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { headingDecoration } from './heading-decoration';

export { headingDecoration } from './heading-decoration';

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
  return [headingDecoration, headingStyles];
}
