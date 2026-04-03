import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { Facet, type Extension, type Range, StateField } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';

/**
 * Facet to provide the base directory for resolving relative image paths.
 * Set this to the directory containing the .md file (e.g., "/Users/ben/docs/").
 * Without it, relative image paths won't resolve in the Tauri webview.
 */
export const imageBasePath = Facet.define<string, string>({
  combine: (values) => values[values.length - 1] ?? '',
});

/** Only allow safe URI schemes for images — block remote fetches by default. */
export function isSafeImageSrc(src: string): boolean {
  // Block javascript: URIs
  if (src.startsWith('javascript:')) return false;
  // Block protocol-relative URLs (//example.com/img.png)
  if (src.startsWith('//')) return false;
  // Allow data: URIs only for images
  if (src.startsWith('data:')) return src.startsWith('data:image/');
  // Allow file:// for local images
  if (src.startsWith('file://')) return true;
  // Block http://, https://, and other remote schemes
  if (src.includes('://')) return false;
  // Allow relative paths (images alongside the .md file)
  return true;
}

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
    private basePath: string,
  ) {
    super();
  }

  /** Resolve a relative image src against the basePath. */
  private resolvedSrc(): string {
    // Already absolute or has a scheme — use as-is
    if (this.src.includes('://') || this.src.startsWith('data:') || this.src.startsWith('/')) {
      return this.src;
    }
    // Relative path — resolve against basePath if available
    if (this.basePath) {
      const base = this.basePath.endsWith('/') ? this.basePath : this.basePath + '/';
      return base + this.src;
    }
    return this.src;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-image-widget';

    if (!isSafeImageSrc(this.src)) {
      wrapper.textContent = `[Remote image blocked: ${this.alt}]`;
      wrapper.style.color = '#f59e0b';
      wrapper.style.fontStyle = 'italic';
      wrapper.style.fontSize = '0.85em';
      return wrapper;
    }

    const img = document.createElement('img');
    img.src = this.resolvedSrc();
    img.alt = this.alt;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '4px';
    img.style.marginTop = '4px';
    img.style.display = 'block';

    img.onerror = () => {
      wrapper.textContent = `[Image not found: ${this.alt}]`;
      wrapper.style.color = '#ef4444';
      wrapper.style.fontStyle = 'italic';
    };

    wrapper.appendChild(img);
    return wrapper;
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt && this.basePath === other.basePath;
  }
}

function buildImageDecorations(state: EditorState): DecorationSet {
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

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Image') return;

      // Check if ANY line spanned by the image node has the cursor
      const startLine = state.doc.lineAt(node.from).number;
      const endLine = state.doc.lineAt(node.to).number;
      for (let l = startLine; l <= endLine; l++) {
        if (cursorLines.has(l)) return false;
      }

      // Use Lezer's parsed tree nodes instead of regex re-parsing
      const urlNode = node.node.getChild('URL');
      if (!urlNode) return false;

      const src = state.doc.sliceString(urlNode.from, urlNode.to);
      const basePath = state.facet(imageBasePath);

      // Extract alt text from between ![...] — use the text between first [ and first ]
      const altMarkNode = node.node.getChild('LinkMark');
      let alt = '';
      if (altMarkNode) {
        const text = state.doc.sliceString(node.from, node.to);
        const altMatch = text.match(/!\[([^\]]*)\]/);
        if (altMatch) alt = altMatch[1];
      }

      // Place widget decoration at the end of the line, as a block widget
      const line = state.doc.lineAt(node.to);
      decorations.push(
        Decoration.widget({
          widget: new ImageWidget(src, alt, basePath),
          block: true,
          side: 1,
        }).range(line.to),
      );

      return false;
    },
  });

  // Sort decorations by from position (required by RangeSet)
  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(decorations);
}

/** StateField that provides block-level image widget decorations.
 *  Block decorations require a StateField (not a ViewPlugin) in CM6. */
const imageField = StateField.define<DecorationSet>({
  create(state) {
    return buildImageDecorations(state);
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.effects.length > 0) {
      return buildImageDecorations(tr.state);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const imageDecoration: Extension = imageField;
