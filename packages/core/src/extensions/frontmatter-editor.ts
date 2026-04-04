import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type Extension, type Range, StateField } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';

/** A parsed key-value pair from YAML frontmatter. */
export interface FrontmatterField {
  key: string;
  value: string;
  /** Absolute document offset of the line containing this field. */
  lineFrom: number;
  /** Absolute document offset of the end of the line. */
  lineTo: number;
  /** True when the value is a complex YAML type (array, object, multi-line) that must be edited in source. */
  readOnly: boolean;
}

/**
 * Parse simple `key: value` pairs from frontmatter content lines.
 * Handles only flat key-value YAML — no nested objects, arrays, or multi-line values.
 */
export function parseFrontmatterFields(
  state: EditorState,
  contentFrom: number,
  contentTo: number,
): FrontmatterField[] {
  const fields: FrontmatterField[] = [];
  const firstLine = state.doc.lineAt(contentFrom);
  const lastLine = state.doc.lineAt(contentTo);

  for (let l = firstLine.number; l <= lastLine.number; l++) {
    const line = state.doc.line(l);
    const text = line.text;
    const colonIndex = text.indexOf(':');
    if (colonIndex <= 0) continue;

    const key = text.substring(0, colonIndex).trim();
    // Skip lines where the key contains spaces (likely continuation or nested YAML)
    if (key.includes(' ') || key.startsWith('-') || key.startsWith('#')) continue;

    const value = text.substring(colonIndex + 1).trim();

    // Complex YAML values (arrays, inline objects, or multi-line block indicators)
    // cannot be safely round-tripped through a single-line text input.
    const readOnly =
      value.startsWith('[') ||
      value.startsWith('{') ||
      value.startsWith('-') ||
      value === '|' ||
      value === '>' ||
      value === '|-' ||
      value === '>-';

    fields.push({
      key,
      value,
      lineFrom: line.from,
      lineTo: line.to,
      readOnly,
    });
  }

  return fields;
}

/**
 * Widget that renders a structured form view of frontmatter fields.
 * Each key-value pair is displayed as a label + input field.
 * Editing an input dispatches a document change to update the corresponding line.
 */
class FrontmatterEditorWidget extends WidgetType {
  constructor(
    private fields: FrontmatterField[],
    private blockFrom: number,
    private blockTo: number,
  ) {
    super();
  }

  eq(other: FrontmatterEditorWidget): boolean {
    if (this.fields.length !== other.fields.length) return false;
    if (this.blockFrom !== other.blockFrom || this.blockTo !== other.blockTo) return false;
    for (let i = 0; i < this.fields.length; i++) {
      const a = this.fields[i];
      const b = other.fields[i];
      if (a.key !== b.key || a.value !== b.value || a.lineFrom !== b.lineFrom || a.lineTo !== b.lineTo || a.readOnly !== b.readOnly) {
        return false;
      }
    }
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-frontmatter-editor';

    for (const field of this.fields) {
      const row = document.createElement('div');
      row.className = 'cm-frontmatter-editor-row';

      const label = document.createElement('label');
      label.className = 'cm-frontmatter-editor-key';
      label.textContent = field.key;

      const input = document.createElement('input');
      input.className = 'cm-frontmatter-editor-value';
      input.type = 'text';
      input.value = field.value;
      input.setAttribute('data-key', field.key);
      input.setAttribute('aria-label', field.key);

      // Mark complex values as read-only with a tooltip explaining why
      if (field.readOnly) {
        input.readOnly = true;
        input.classList.add('cm-frontmatter-editor-value--readonly');
        input.title = 'Complex YAML values must be edited in source';
      }

      // Capture only the key (not position) — positions are scanned fresh on each change
      const fieldKey = field.key;
      const blockFrom = this.blockFrom;
      const blockTo = this.blockTo;

      input.addEventListener('change', (e) => {
        e.preventDefault();
        if ((e.target as HTMLInputElement).readOnly) return;
        const newValue = (e.target as HTMLInputElement).value;
        const newLineText = `${fieldKey}: ${newValue}`;
        // Scan the frontmatter block to find the current position of this key's line.
        // This avoids stale position captures when earlier fields have been edited.
        const doc = view.state.doc;
        for (let pos = blockFrom; pos < blockTo;) {
          const line = doc.lineAt(pos);
          if (line.text.startsWith(fieldKey + ':')) {
            view.dispatch({
              changes: { from: line.from, to: line.to, insert: newLineText },
            });
            break;
          }
          pos = line.to + 1;
        }
      });

      // Prevent CM6 from stealing focus when clicking inside the input
      input.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Return focus to the editor
          view.focus();
          e.preventDefault();
        }
        // Stop propagation so CM6 keybindings don't interfere
        e.stopPropagation();
      });

      row.appendChild(label);
      row.appendChild(input);
      wrapper.appendChild(row);
    }

    return wrapper;
  }

  ignoreEvent(): boolean {
    // Ignore all events so CM6 doesn't move the cursor when clicking inputs.
    // The widget handles its own mouse/keyboard events internally.
    return true;
  }

  destroy(): void {
    // No cleanup needed
  }
}

/**
 * Check if the cursor is inside the frontmatter block (any line from
 * the opening `---` to the closing `---`, inclusive).
 */
function isCursorInsideFrontmatter(
  state: EditorState,
  blockFrom: number,
  blockTo: number,
): boolean {
  const firstLine = state.doc.lineAt(blockFrom);
  const lastLine = state.doc.lineAt(blockTo);

  const cursorLines = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      cursorLines.add(l);
    }
  }

  for (let l = firstLine.number; l <= lastLine.number; l++) {
    if (cursorLines.has(l)) return true;
  }
  return false;
}

/**
 * Build decorations for the frontmatter editor widget.
 * When cursor is outside the frontmatter block, replaces the entire block
 * with a form widget. When cursor is inside, returns no decorations
 * (the existing frontmatter-decoration handles cursor-inside styling).
 */
function buildFrontmatterEditorDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FrontmatterBlock') return;

      const blockFrom = node.from;
      const blockTo = node.to;

      // If cursor is inside the frontmatter, don't show the widget
      if (isCursorInsideFrontmatter(state, blockFrom, blockTo)) {
        return false;
      }

      // Find content range (between the delimiter markers)
      const contentNode = node.node.getChild('FrontmatterContent');

      // No content between delimiters — empty frontmatter
      if (contentNode === null) {
        return false;
      }

      const contentFrom = contentNode.from;
      const contentTo = contentNode.to;

      const fields = parseFrontmatterFields(state, contentFrom, contentTo);
      if (fields.length === 0) {
        return false;
      }

      // Replace the entire frontmatter block with the widget
      decorations.push(
        Decoration.replace({
          widget: new FrontmatterEditorWidget(fields, blockFrom, blockTo),
          block: true,
        }).range(blockFrom, blockTo),
      );

      return false;
    },
  });

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

/**
 * StateField that manages the frontmatter editor widget decorations.
 * Block decorations (replace with block: true) require a StateField, not a ViewPlugin.
 */
const frontmatterEditorField = StateField.define<DecorationSet>({
  create(state) {
    return buildFrontmatterEditorDecorations(state);
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildFrontmatterEditorDecorations(tr.state);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

/** Base theme styles for the frontmatter editor widget. */
export const frontmatterEditorStyles = EditorView.baseTheme({
  '.cm-frontmatter-editor': {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '0.9em',
    padding: '8px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderLeft: '2px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '0 4px 4px 0',
    margin: '0 0 4px 0',
  },
  '.cm-frontmatter-editor-row': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '2px 0',
  },
  '.cm-frontmatter-editor-key': {
    flexShrink: '0',
    minWidth: '80px',
    fontWeight: '600',
    color: '#6366f1',
    fontSize: '0.9em',
    textAlign: 'right',
    paddingRight: '4px',
    userSelect: 'none',
  },
  '.cm-frontmatter-editor-value': {
    flex: '1',
    padding: '2px 6px',
    border: '1px solid #d1d5db',
    borderRadius: '3px',
    fontSize: '0.9em',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    color: '#334155',
    backgroundColor: '#ffffff',
    outline: 'none',
    lineHeight: '1.5',
  },
  '.cm-frontmatter-editor-value:focus': {
    borderColor: '#6366f1',
    boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.3)',
  },
  '.cm-frontmatter-editor-value--readonly': {
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    cursor: 'not-allowed',
    fontStyle: 'italic',
  },
  '.cm-frontmatter-editor-value--readonly:focus': {
    borderColor: '#d1d5db',
    boxShadow: 'none',
  },
  // Dark mode
  '&dark .cm-frontmatter-editor': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderLeftColor: 'rgba(99, 102, 241, 0.4)',
  },
  '&dark .cm-frontmatter-editor-key': {
    color: '#a5b4fc',
  },
  '&dark .cm-frontmatter-editor-value': {
    border: '1px solid #4b5563',
    color: '#e2e8f0',
    backgroundColor: '#1e293b',
  },
  '&dark .cm-frontmatter-editor-value:focus': {
    borderColor: '#818cf8',
    boxShadow: '0 0 0 1px rgba(129, 140, 248, 0.3)',
  },
  '&dark .cm-frontmatter-editor-value--readonly': {
    color: '#6b7280',
    backgroundColor: '#111827',
    cursor: 'not-allowed',
  },
  '&dark .cm-frontmatter-editor-value--readonly:focus': {
    borderColor: '#4b5563',
    boxShadow: 'none',
  },
});

/** Frontmatter structured editor extension: StateField + styles. */
export const frontmatterEditor: Extension = [
  frontmatterEditorField,
  frontmatterEditorStyles,
];
