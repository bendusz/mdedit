import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

/**
 * Supported admonition/callout types.
 *
 * GitHub alerts: NOTE, TIP, IMPORTANT, WARNING, CAUTION
 * Obsidian extras: INFO, SUCCESS, QUESTION, FAILURE, DANGER, BUG, EXAMPLE, QUOTE
 */
export type AdmonitionType =
  | 'NOTE'
  | 'TIP'
  | 'IMPORTANT'
  | 'WARNING'
  | 'CAUTION'
  | 'INFO'
  | 'SUCCESS'
  | 'QUESTION'
  | 'FAILURE'
  | 'DANGER'
  | 'BUG'
  | 'EXAMPLE'
  | 'QUOTE';

/** Map admonition types to their CSS class suffix (used for color theming). */
const typeToColorClass: Record<AdmonitionType, string> = {
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

/** Map admonition types to display icons (emoji). */
const typeToIcon: Record<AdmonitionType, string> = {
  NOTE: '\u2139\uFE0F',      // info
  TIP: '\uD83D\uDCA1',       // bulb
  IMPORTANT: '\u2757',       // exclamation
  WARNING: '\u26A0\uFE0F',   // warning sign
  CAUTION: '\uD83D\uDED1',   // stop sign
  INFO: '\u2139\uFE0F',      // info
  SUCCESS: '\u2705',          // check mark
  QUESTION: '\u2753',         // question mark
  FAILURE: '\u274C',          // cross mark
  DANGER: '\u26A0\uFE0F',    // warning sign
  BUG: '\uD83D\uDC1B',       // bug
  EXAMPLE: '\uD83D\uDCDD',   // memo
  QUOTE: '\u275D',            // heavy double turned comma quotation mark
};

/** Regex to detect the callout header: > [!TYPE] with optional custom title (case-insensitive) */
const calloutHeaderRegex = /^>\s*\[!(\w+)\]\s*(.*)$/;

/** All valid admonition type names, for validation. */
const validTypes = new Set<string>(Object.keys(typeToColorClass));

/**
 * Parse a callout type string (case-insensitive) into a valid AdmonitionType,
 * or return null if it's not a recognized type.
 */
export function parseAdmonitionType(raw: string): AdmonitionType | null {
  const upper = raw.toUpperCase();
  if (validTypes.has(upper)) {
    return upper as AdmonitionType;
  }
  return null;
}

/**
 * Widget that replaces the `> [!TYPE]` header line with a styled callout header.
 * If a custom title is provided it is displayed instead of the default type label.
 */
class AdmonitionHeaderWidget extends WidgetType {
  constructor(
    private admonitionType: AdmonitionType,
    private customTitle: string = '',
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = `cm-admonition-header cm-admonition-header-${typeToColorClass[this.admonitionType]}`;
    const icon = typeToIcon[this.admonitionType];
    const label = this.customTitle
      ? this.customTitle
      : this.admonitionType.charAt(0) + this.admonitionType.slice(1).toLowerCase();
    span.textContent = `${icon} ${label}`;
    return span;
  }

  eq(other: AdmonitionHeaderWidget): boolean {
    return this.admonitionType === other.admonitionType && this.customTitle === other.customTitle;
  }
}

/**
 * Given a Blockquote node, check if its first line matches the `> [!TYPE]`
 * pattern and return the parsed type and optional custom title if so.
 */
function detectAdmonitionInBlockquote(
  state: EditorState,
  blockquoteFrom: number,
): { type: AdmonitionType; customTitle: string } | null {
  const firstLine = state.doc.lineAt(blockquoteFrom);
  const match = calloutHeaderRegex.exec(firstLine.text);
  if (!match) return null;
  const admonitionType = parseAdmonitionType(match[1]);
  if (!admonitionType) return null;
  return { type: admonitionType, customTitle: match[2].trim() };
}

/**
 * Build all admonition decorations for the current editor state.
 *
 * Uses line decorations (Decoration.line) for the container styling and
 * replace decorations for the [!TYPE] marker header line -- both are safe
 * to use inside a ViewPlugin.
 */
function buildAdmonitionDecorations(state: EditorState): DecorationSet {
  const lineDecorations: Range<Decoration>[] = [];
  const replaceDecorations: Range<Decoration>[] = [];

  // Collect cursor lines for reveal-on-cursor behavior
  const cursorLines = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      cursorLines.add(l);
    }
  }

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Blockquote') return;

      const detected = detectAdmonitionInBlockquote(state, node.from);
      if (!detected) return; // Not an admonition, skip (regular blockquote)

      const { type: admonitionType, customTitle } = detected;
      const colorClass = typeToColorClass[admonitionType];
      const firstLine = state.doc.lineAt(node.from);
      const lastLine = state.doc.lineAt(node.to);

      // Check if the cursor is anywhere inside this admonition block
      let cursorInsideBlock = false;
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        if (cursorLines.has(l)) {
          cursorInsideBlock = true;
          break;
        }
      }

      // Build a Map of QuoteMark positions in a single pass to avoid O(N²) traversal
      const quoteMarkByLine = new Map<number, { from: number; to: number }>();
      let child = node.node.firstChild;
      while (child) {
        if (child.name === 'QuoteMark') {
          quoteMarkByLine.set(state.doc.lineAt(child.from).number, {
            from: child.from,
            to: child.to,
          });
        }
        child = child.nextSibling;
      }

      for (let l = firstLine.number; l <= lastLine.number; l++) {
        const line = state.doc.line(l);

        // Apply admonition line class to every line in the block
        lineDecorations.push(
          Decoration.line({
            class: `cm-admonition cm-admonition-${colorClass}`,
          }).range(line.from),
        );

        if (l === firstLine.number) {
          // Header line: replace `> [!TYPE]` with styled widget when cursor is outside
          if (!cursorInsideBlock) {
            // Replace entire line content with the header widget
            replaceDecorations.push(
              Decoration.replace({
                widget: new AdmonitionHeaderWidget(admonitionType, customTitle),
              }).range(line.from, line.to),
            );
          }
        } else if (!cursorInsideBlock) {
          // Non-header lines: hide the `> ` prefix when cursor is outside
          const mark = quoteMarkByLine.get(l);
          if (mark) {
            let hideEnd = mark.to;
            if (
              hideEnd < line.to &&
              state.doc.sliceString(hideEnd, hideEnd + 1) === ' '
            ) {
              hideEnd++;
            }
            replaceDecorations.push(
              Decoration.replace({}).range(mark.from, hideEnd),
            );
          }
        }
      }
    },
  });

  // Line decorations must come before replace decorations at the same position
  lineDecorations.sort((a, b) => a.from - b.from);
  replaceDecorations.sort((a, b) => a.from - b.from);

  const lineSet = Decoration.set(lineDecorations);
  return lineSet.update({ add: replaceDecorations, sort: true });
}

export const admonitionDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildAdmonitionDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildAdmonitionDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export const admonitionStyles = EditorView.baseTheme({
  /* Base admonition styles */
  '.cm-admonition': {
    paddingLeft: '12px',
    borderLeft: '4px solid',
  },

  /* Color variants -- light theme */
  '.cm-admonition-blue': {
    borderLeftColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  '.cm-admonition-green': {
    borderLeftColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  '.cm-admonition-purple': {
    borderLeftColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
  },
  '.cm-admonition-amber': {
    borderLeftColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  '.cm-admonition-red': {
    borderLeftColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  '.cm-admonition-yellow': {
    borderLeftColor: '#eab308',
    backgroundColor: 'rgba(234, 179, 8, 0.06)',
  },
  '.cm-admonition-gray': {
    borderLeftColor: '#6b7280',
    backgroundColor: 'rgba(107, 114, 128, 0.06)',
  },

  /* Header styling */
  '.cm-admonition-header': {
    fontWeight: '600',
    fontSize: '0.95em',
  },
  '.cm-admonition-header-blue': { color: '#2563eb' },
  '.cm-admonition-header-green': { color: '#16a34a' },
  '.cm-admonition-header-purple': { color: '#7c3aed' },
  '.cm-admonition-header-amber': { color: '#d97706' },
  '.cm-admonition-header-red': { color: '#dc2626' },
  '.cm-admonition-header-yellow': { color: '#ca8a04' },
  '.cm-admonition-header-gray': { color: '#4b5563' },

  /* Dark theme overrides */
  '&dark .cm-admonition-blue': {
    borderLeftColor: '#60a5fa',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  '&dark .cm-admonition-green': {
    borderLeftColor: '#4ade80',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  '&dark .cm-admonition-purple': {
    borderLeftColor: '#a78bfa',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  '&dark .cm-admonition-amber': {
    borderLeftColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  '&dark .cm-admonition-red': {
    borderLeftColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  '&dark .cm-admonition-yellow': {
    borderLeftColor: '#facc15',
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
  },
  '&dark .cm-admonition-gray': {
    borderLeftColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.08)',
  },
  '&dark .cm-admonition-header-blue': { color: '#60a5fa' },
  '&dark .cm-admonition-header-green': { color: '#4ade80' },
  '&dark .cm-admonition-header-purple': { color: '#a78bfa' },
  '&dark .cm-admonition-header-amber': { color: '#fbbf24' },
  '&dark .cm-admonition-header-red': { color: '#f87171' },
  '&dark .cm-admonition-header-yellow': { color: '#facc15' },
  '&dark .cm-admonition-header-gray': { color: '#9ca3af' },
});
