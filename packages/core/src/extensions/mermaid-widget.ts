import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type Extension, type Range, StateField, Facet } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';
import mermaid from 'mermaid';

/**
 * Facet to communicate the current dark-mode state to the mermaid renderer.
 * When true, mermaid will use its "dark" theme; otherwise "default".
 */
export const mermaidDarkMode = Facet.define<boolean, boolean>({
  combine: (values) => values[values.length - 1] ?? false,
});

/** SVG render cache keyed by mermaid source text + dark mode. */
const svgCache = new Map<string, { svg: string; error: boolean }>();

/** Counter to generate unique IDs for mermaid.render() calls. */
let renderIdCounter = 0;

/**
 * Initialize mermaid with the given theme.
 */
function ensureMermaidInit(dark: boolean): void {
  const theme = dark ? 'dark' : 'default';
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
    logLevel: 'error' as any,
  });
}

/**
 * Render mermaid source to SVG. Returns cached result if available.
 * On error, returns an error message string (not HTML).
 */
async function renderMermaidSvg(
  source: string,
  dark: boolean,
): Promise<{ svg: string; error: boolean }> {
  const cacheKey = `${dark ? 'dark' : 'light'}:${source}`;
  const cached = svgCache.get(cacheKey);
  if (cached !== undefined) return cached;

  ensureMermaidInit(dark);

  try {
    const id = `mermaid-render-${renderIdCounter++}`;
    const { svg } = await mermaid.render(id, source);
    const result = { svg, error: false };
    svgCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    const result = {
      svg: `Mermaid error: ${err?.message || String(err)}`,
      error: true,
    };
    svgCache.set(cacheKey, result);
    return result;
  }
}

/**
 * Safely set SVG content by parsing it first and only inserting
 * valid SVG elements into the DOM.
 */
function setSvgContent(container: HTMLElement, svgString: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError || svgEl.tagName !== 'svg') {
    container.textContent = 'Failed to parse diagram SVG';
    return;
  }

  // Import the parsed SVG node into our document
  const imported = document.importNode(svgEl, true);
  container.appendChild(imported);
}

/**
 * Widget that displays a rendered mermaid diagram (SVG) below the code block.
 */
class MermaidWidget extends WidgetType {
  private cancelled = false;

  constructor(
    private source: string,
    private dark: boolean,
  ) {
    super();
  }

  toDOM(_view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-mermaid-widget';

    // Start with a loading state
    const loading = document.createElement('div');
    loading.className = 'cm-mermaid-loading';
    loading.textContent = 'Rendering diagram\u2026';
    wrapper.appendChild(loading);

    // Render asynchronously and update the DOM.
    // Guard against updating a detached widget after CM6 has destroyed it.
    renderMermaidSvg(this.source, this.dark).then((result) => {
      if (this.cancelled) return;

      // Clear loading indicator
      while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

      if (result.error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'cm-mermaid-error';
        errorDiv.textContent = result.svg;
        wrapper.appendChild(errorDiv);
      } else {
        setSvgContent(wrapper, result.svg);
      }
    });

    return wrapper;
  }

  destroy(): void {
    this.cancelled = true;
  }

  eq(other: MermaidWidget): boolean {
    return this.source === other.source && this.dark === other.dark;
  }
}

/**
 * Extract the info string (language identifier) from a FencedCode node.
 * The info string is on the opening fence line, after the ``` markers.
 */
function getFencedCodeInfo(state: EditorState, nodeFrom: number): string {
  const firstLine = state.doc.lineAt(nodeFrom);
  const lineText = firstLine.text;
  const match = lineText.match(/^(`{3,}|~{3,})\s*(\S+)?/);
  return match?.[2] ?? '';
}

/**
 * Extract the code content from a FencedCode block (excluding fence lines).
 */
function getFencedCodeContent(
  state: EditorState,
  nodeFrom: number,
  nodeTo: number,
): string {
  const firstLine = state.doc.lineAt(nodeFrom);
  const lastLine = state.doc.lineAt(nodeTo);

  // A fenced code block needs at least: opening fence, one content line, closing fence.
  // If firstLine and lastLine are the same or adjacent, there is no content between them.
  if (firstLine.number >= lastLine.number - 1) return '';

  const contentStart = state.doc.line(firstLine.number + 1).from;
  const contentEnd = state.doc.line(lastLine.number - 1).to;

  if (contentStart > contentEnd) return '';
  return state.doc.sliceString(contentStart, contentEnd);
}

function buildMermaidDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const dark = state.facet(mermaidDarkMode);

  // Determine which lines the cursor is on
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
      if (node.name !== 'FencedCode') return;

      const info = getFencedCodeInfo(state, node.from);
      if (info.toLowerCase() !== 'mermaid') return;

      const blockFrom = node.from;
      const blockTo = node.to;
      const firstLine = state.doc.lineAt(blockFrom);
      const lastLine = state.doc.lineAt(blockTo);

      // Check if cursor is inside any line of this code block
      for (let l = firstLine.number; l <= lastLine.number; l++) {
        if (cursorLines.has(l)) return;
      }

      const source = getFencedCodeContent(state, blockFrom, blockTo).trim();
      if (!source) return;

      decorations.push(
        Decoration.widget({
          widget: new MermaidWidget(source, dark),
          block: true,
          side: 1,
        }).range(lastLine.to),
      );
    },
  });

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

/** StateField that provides block-level mermaid widget decorations.
 *  Block decorations require a StateField (not a ViewPlugin) in CM6. */
const mermaidField = StateField.define<DecorationSet>({
  create(state) {
    return buildMermaidDecorations(state);
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.effects.length > 0) {
      return buildMermaidDecorations(tr.state);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

const mermaidStyles = EditorView.baseTheme({
  '.cm-mermaid-widget': {
    display: 'flex',
    justifyContent: 'center',
    padding: '12px 0',
    maxWidth: '100%',
    overflow: 'auto',
  },
  '.cm-mermaid-widget svg': {
    maxWidth: '100%',
    height: 'auto',
  },
  '.cm-mermaid-error': {
    color: '#ef4444',
    fontStyle: 'italic',
    fontSize: '0.85em',
    padding: '8px 12px',
    backgroundColor: '#fef2f2',
    borderRadius: '4px',
    border: '1px solid #fecaca',
  },
  '.cm-mermaid-loading': {
    color: '#6b7280',
    fontStyle: 'italic',
    fontSize: '0.85em',
    padding: '8px 0',
  },
});

/**
 * Clear the mermaid SVG render cache. Useful when switching themes.
 */
export function clearMermaidCache(): void {
  svgCache.clear();
}

// Note: mermaidDarkMode facet is NOT included here.
// editor.ts owns it via mermaidDarkModeCompartment so theme changes can reconfigure it.
// The facet defaults to false (light mode) when not explicitly provided.
export const mermaidWidget: Extension = [
  mermaidField,
  mermaidStyles,
];
