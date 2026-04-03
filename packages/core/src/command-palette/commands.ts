import { EditorView } from '@codemirror/view';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  insertLink,
  insertImage,
  setHeading,
  toggleList,
  toggleTaskList,
  insertCodeBlock,
  insertHorizontalRule,
  insertTable,
} from '../toolbar/commands';

/** A command that can appear in the command palette. */
export interface PaletteCommand {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  execute: (view: EditorView) => void;
}

/** Returns the built-in editor commands for the command palette. */
export function defaultCommands(): PaletteCommand[] {
  return [
    // Formatting
    { id: 'bold', label: 'Bold', category: 'Formatting', shortcut: '⌘B', execute: toggleBold },
    { id: 'italic', label: 'Italic', category: 'Formatting', shortcut: '⌘I', execute: toggleItalic },
    { id: 'strikethrough', label: 'Strikethrough', category: 'Formatting', shortcut: '⌘⇧X', execute: toggleStrikethrough },
    { id: 'insert-link', label: 'Insert Link', category: 'Formatting', shortcut: '⌘K', execute: insertLink },
    { id: 'insert-image', label: 'Insert Image', category: 'Formatting', execute: insertImage },

    // Headings
    { id: 'heading-1', label: 'Heading 1', category: 'Headings', execute: (view) => setHeading(view, 1) },
    { id: 'heading-2', label: 'Heading 2', category: 'Headings', execute: (view) => setHeading(view, 2) },
    { id: 'heading-3', label: 'Heading 3', category: 'Headings', execute: (view) => setHeading(view, 3) },
    { id: 'heading-4', label: 'Heading 4', category: 'Headings', execute: (view) => setHeading(view, 4) },
    { id: 'heading-5', label: 'Heading 5', category: 'Headings', execute: (view) => setHeading(view, 5) },
    { id: 'heading-6', label: 'Heading 6', category: 'Headings', execute: (view) => setHeading(view, 6) },

    // Blocks
    { id: 'code-block', label: 'Code Block', category: 'Blocks', shortcut: '⌘⇧C', execute: insertCodeBlock },
    { id: 'horizontal-rule', label: 'Horizontal Rule', category: 'Blocks', execute: insertHorizontalRule },
    { id: 'table', label: 'Table', category: 'Blocks', execute: insertTable },

    // Lists
    { id: 'bullet-list', label: 'Bullet List', category: 'Lists', execute: toggleList },
    { id: 'task-list', label: 'Task List', category: 'Lists', execute: toggleTaskList },
  ];
}

/**
 * Simple fuzzy match: checks if all characters of the query appear
 * in order within the target string (case-insensitive).
 * Returns a score (lower is better) or -1 for no match.
 */
export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return 0;

  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for consecutive matches
      const gap = lastMatchIndex === -1 ? 0 : ti - lastMatchIndex - 1;
      score += gap;
      // Bonus for matching at start of word
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') {
        score -= 1;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }

  // All query characters must be found
  if (qi < q.length) return -1;

  // Ensure successful matches always return >= 0
  return Math.max(0, score);
}

/**
 * Return the best (lowest non-negative) score from matching query
 * against the label alone and against "category label".
 * Returns -1 if neither matches.
 */
function bestScore(query: string, cmd: PaletteCommand): number {
  const s1 = fuzzyMatch(query, cmd.label);
  const s2 = fuzzyMatch(query, `${cmd.category} ${cmd.label}`);
  if (s1 < 0 && s2 < 0) return -1;
  if (s1 < 0) return s2;
  if (s2 < 0) return s1;
  return Math.min(s1, s2);
}

/** Filter and sort commands by fuzzy matching against the query. */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  if (!query) return commands;

  const scored = commands
    .map((cmd) => ({ cmd, score: bestScore(query, cmd) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score);

  return scored.map(({ cmd }) => cmd);
}
