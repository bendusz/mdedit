import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

export interface OutlineEntry {
  level: number;
  text: string;
  from: number;
  to: number;
}

const headingNodes: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
  SetextHeading1: 1,
  SetextHeading2: 2,
};

/**
 * Extract an ordered list of headings from the editor state's syntax tree.
 * Returns ATX headings (# through ######) with their level, display text
 * (without the leading `#` marks), and document positions.
 */
export function getOutline(state: EditorState): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      const level = headingNodes[node.name];
      if (level !== undefined) {
        const fullText = state.sliceDoc(node.from, node.to);
        let text: string;
        if (node.name.startsWith('Setext')) {
          // Setext headings: "Title\n===" — take only the first line
          text = fullText.split('\n')[0].trim();
        } else {
          // ATX headings: strip leading and trailing # marks
          text = fullText.replace(/^#{1,6}\s*/, '').replace(/\s*#{1,6}\s*$/, '').trim();
        }
        entries.push({ level, text, from: node.from, to: node.to });
      }
    },
  });

  return entries;
}
