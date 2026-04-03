import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

interface InlineRule {
  nodeNames: string[];
  markName: string;
  className: string;
}

const inlineRules: InlineRule[] = [
  { nodeNames: ['StrongEmphasis'], markName: 'EmphasisMark', className: 'cm-bold' },
  { nodeNames: ['Emphasis'], markName: 'EmphasisMark', className: 'cm-italic' },
  { nodeNames: ['Strikethrough'], markName: 'StrikethroughMark', className: 'cm-strikethrough' },
];

/** Map from node name to rule for O(1) lookup. */
const ruleByNodeName = new Map<string, InlineRule>();
for (const rule of inlineRules) {
  for (const name of rule.nodeNames) {
    ruleByNodeName.set(name, rule);
  }
}

/**
 * Recursively process a matched inline node and its children.
 * This handles nested emphasis (e.g., ***bold italic***) by processing
 * both the parent StrongEmphasis and the child Emphasis.
 */
function processInlineNode(
  node: SyntaxNode,
  rule: InlineRule,
  cursorLines: Set<number>,
  state: EditorState,
  decorations: Range<Decoration>[],
) {
  // Apply the formatting class to the entire node range
  decorations.push(
    Decoration.mark({ class: rule.className }).range(node.from, node.to),
  );

  // Walk direct children to find mark nodes to hide, and nested inline nodes to recurse
  let child = node.firstChild;
  while (child) {
    if (child.name === rule.markName) {
      decorations.push(
        Decoration.replace({}).range(child.from, child.to),
      );
    } else {
      // Check if this child is itself an inline formatting node
      const childRule = ruleByNodeName.get(child.name);
      if (childRule) {
        processInlineNode(child, childRule, cursorLines, state, decorations);
      } else {
        // Recurse into non-format children (e.g., Link nodes) to find
        // nested emphasis like [**bold link**](url)
        let grandchild = child.firstChild;
        while (grandchild) {
          const gcRule = ruleByNodeName.get(grandchild.name);
          if (gcRule) {
            processInlineNode(grandchild, gcRule, cursorLines, state, decorations);
          }
          grandchild = grandchild.nextSibling;
        }
      }
    }
    child = child.nextSibling;
  }
}

function buildInlineDecorations(state: EditorState): DecorationSet {
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
      const rule = ruleByNodeName.get(node.name);
      if (!rule) return;

      // Check if ANY line spanned by this node is a cursor line
      const startLine = state.doc.lineAt(node.from).number;
      const endLine = state.doc.lineAt(node.to).number;
      for (let l = startLine; l <= endLine; l++) {
        if (cursorLines.has(l)) return false;
      }

      processInlineNode(node.node, rule, cursorLines, state, decorations);

      // Return false to skip children in the iterator — we handle them recursively
      return false;
    },
  });

  // Sort decorations by from position (required by RangeSet)
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  return Decoration.set(decorations);
}

export const inlineDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildInlineDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildInlineDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export const inlineStyles = EditorView.baseTheme({
  '.cm-bold': { fontWeight: '700' },
  '.cm-italic': { fontStyle: 'italic' },
  '.cm-strikethrough': { textDecoration: 'line-through', color: '#9ca3af' },
});
