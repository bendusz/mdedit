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
 * Regex to match footnote references like [^1], [^note], [^my-label]
 * Must NOT be at the start of a line followed by `:` (that's a definition).
 */
const footnoteRefRegex = /\[\^([^\]\s]+)\]/g;

/**
 * Regex to match footnote definitions at the start of a line:
 * [^label]: content
 */
const footnoteDefRegex = /^\[\^([^\]\s]+)\]:\s*/;

/** Map numeric labels to superscript characters for compact display. */
const superscriptDigits: Record<string, string> = {
  '0': '\u2070',
  '1': '\u00B9',
  '2': '\u00B2',
  '3': '\u00B3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
  '7': '\u2077',
  '8': '\u2078',
  '9': '\u2079',
};

/** Convert a label to a superscript display string. */
function toSuperscript(label: string): string {
  // If the label is purely numeric, convert each digit
  if (/^\d+$/.test(label)) {
    return label
      .split('')
      .map((ch) => superscriptDigits[ch] ?? ch)
      .join('');
  }
  // For text labels, return the label in superscript style (handled via CSS)
  return label;
}

/**
 * Widget that renders a footnote reference as a styled superscript.
 */
class FootnoteRefWidget extends WidgetType {
  constructor(
    private label: string,
    private defLineNumber: number | null,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-footnote-ref';
    span.textContent = toSuperscript(this.label);
    span.title = `Footnote: ${this.label}`;
    if (this.defLineNumber !== null) {
      span.dataset.defLine = String(this.defLineNumber);
    }
    return span;
  }

  eq(other: FootnoteRefWidget): boolean {
    return this.label === other.label && this.defLineNumber === other.defLineNumber;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Collect all footnote definition locations in the document.
 * Returns a Map from label to line number (1-based).
 */
function collectFootnoteDefinitions(state: EditorState): Map<string, number> {
  const defs = new Map<string, number>();
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const match = footnoteDefRegex.exec(line.text);
    if (match) {
      defs.set(match[1], i);
    }
  }
  return defs;
}

function buildFootnoteDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  // Determine which lines the cursor is on
  const cursorLines = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      cursorLines.add(l);
    }
  }

  // Collect all footnote definition locations for jump-to-def
  const defLocations = collectFootnoteDefinitions(state);

  // Process each line
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const isCursorLine = cursorLines.has(i);

    // Check if this line is a footnote definition
    const defMatch = footnoteDefRegex.exec(line.text);
    if (defMatch) {
      // Always style definition lines with a line decoration (even when cursor is on them)
      decorations.push(
        Decoration.line({ class: 'cm-footnote-def' }).range(line.from),
      );

      // If cursor is NOT on this line, hide the [^label]: prefix and show styled content
      if (!isCursorLine) {
        // Hide the [^label]: part
        const prefixEnd = line.from + defMatch[0].length;
        decorations.push(
          Decoration.replace({
            widget: new FootnoteDefLabelWidget(defMatch[1]),
          }).range(line.from, prefixEnd),
        );
      }

      // Don't process footnote references within definition lines
      continue;
    }

    // For non-definition lines, find footnote references
    if (isCursorLine) continue; // Show raw syntax when cursor is on the line

    footnoteRefRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = footnoteRefRegex.exec(line.text)) !== null) {
      const label = match[1];
      const from = line.from + match.index;
      const to = from + match[0].length;

      // Make sure this isn't part of an image syntax like [![...]
      const charBefore = match.index > 0 ? line.text[match.index - 1] : '';
      if (charBefore === '!') continue;

      const defLine = defLocations.get(label) ?? null;

      decorations.push(
        Decoration.replace({
          widget: new FootnoteRefWidget(label, defLine),
        }).range(from, to),
      );
    }
  }

  return Decoration.set(decorations, true);
}

/**
 * Widget that renders the footnote definition label in a compact styled form.
 */
class FootnoteDefLabelWidget extends WidgetType {
  constructor(private label: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-footnote-def-label';
    span.textContent = `${toSuperscript(this.label)} `;
    return span;
  }

  eq(other: FootnoteDefLabelWidget): boolean {
    return this.label === other.label;
  }
}

export const footnoteDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFootnoteDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildFootnoteDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event: MouseEvent, view: EditorView) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('cm-footnote-ref')) return false;
        const defLine = target.dataset.defLine;
        if (!defLine) return false;

        const lineNumber = parseInt(defLine, 10);
        if (isNaN(lineNumber)) return false;

        const line = view.state.doc.line(lineNumber);
        view.dispatch({
          selection: { anchor: line.from },
          scrollIntoView: true,
        });
        return true;
      },
    },
  },
);

export const footnoteStyles = EditorView.baseTheme({
  '.cm-footnote-ref': {
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '0.8em',
    verticalAlign: 'super',
    fontWeight: '600',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  '.cm-footnote-def': {
    borderLeft: '3px solid #e2e8f0',
    paddingLeft: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  '.cm-footnote-def-label': {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: '0.85em',
  },

  /* Dark theme overrides */
  '&dark .cm-footnote-def': {
    borderLeft: '3px solid #475569',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
});
