import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

/**
 * Typewriter scrolling — keeps the cursor line vertically centered
 * in the viewport as the user types or moves the cursor.
 *
 * Defers the scroll dispatch via a microtask (Promise.resolve().then())
 * so it runs outside the current CM6 update cycle, preventing the
 * "dispatch during update" re-entrancy error.
 */
const typewriterPlugin = ViewPlugin.fromClass(
  class {
    destroyed = false;

    update(update: ViewUpdate) {
      if (!update.selectionSet && !update.docChanged) return;
      const head = update.state.selection.main.head;
      const view = update.view;
      Promise.resolve().then(() => {
        if (this.destroyed) return;
        view.dispatch({
          effects: EditorView.scrollIntoView(head, { y: 'center' }),
        });
      });
    }

    destroy() {
      this.destroyed = true;
    }
  },
);

/**
 * Returns a typewriter scrolling extension that keeps the cursor line
 * vertically centered in the viewport. Designed to be toggled via a
 * compartment — not included in the default editor extensions.
 *
 * Uses `EditorView.theme` (not `baseTheme`) so the smooth scroll CSS
 * is removed when the compartment is cleared on disable.
 */
export function typewriterScrolling() {
  return [
    typewriterPlugin,
    EditorView.theme({ '.cm-scroller': { scrollBehavior: 'smooth' } }),
  ];
}
