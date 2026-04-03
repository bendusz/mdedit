import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type Extension, type Range, StateField } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';

/** Only allow safe URI schemes for images — block remote fetches by default. */
export function isSafeImageSrc(src: string): boolean {
  // Block javascript: URIs
  if (src.startsWith('javascript:')) return false;
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
  ) {
    super();
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
    img.src = this.src;
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
    return this.src === other.src && this.alt === other.alt;
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

      // Extract the full text of the image node
      const text = state.doc.sliceString(node.from, node.to);

      // Extract alt text and src from the image syntax
      const altMatch = text.match(/!\[([^\]]*)\]/);
      const srcMatch = text.match(/\]\(([^)]+)\)/);

      if (!srcMatch) return false;

      const alt = altMatch ? altMatch[1] : '';
      const src = srcMatch[1];

      // Place widget decoration at the end of the line, as a block widget
      const line = state.doc.lineAt(node.to);
      decorations.push(
        Decoration.widget({
          widget: new ImageWidget(src, alt),
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
    if (tr.docChanged || tr.selection) {
      return buildImageDecorations(tr.state);
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export const imageDecoration: Extension = imageField;
