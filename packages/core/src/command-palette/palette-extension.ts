import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, showPanel, keymap, type Panel } from '@codemirror/view';
import { type PaletteCommand, defaultCommands, filterCommands } from './commands';

/** Effect to toggle the command palette open/closed. */
const togglePalette = StateEffect.define<boolean>();

/** Effect to set extra (app-level) commands. */
const setExtraCommands = StateEffect.define<PaletteCommand[]>();

/** State field tracking extra commands registered by the app shell. */
const extraCommandsField = StateField.define<PaletteCommand[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setExtraCommands)) return e.value;
    }
    return value;
  },
});

/** Register additional commands (e.g. app-level file operations) into the palette. */
export function registerPaletteCommands(view: EditorView, commands: PaletteCommand[]) {
  view.dispatch({ effects: setExtraCommands.of(commands) });
}

/** State field tracking whether the palette is open. */
const paletteState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(togglePalette)) return e.value;
    }
    return value;
  },
  provide: (f) =>
    showPanel.from(f, (on) => (on ? createPalettePanel : null)),
});

/** Open the command palette. */
export function showCommandPalette(view: EditorView): boolean {
  view.dispatch({ effects: togglePalette.of(true) });
  return true;
}

/** Close the command palette. */
function closePalette(view: EditorView) {
  view.dispatch({ effects: togglePalette.of(false) });
  view.focus();
}

/** Remove all child nodes from an element safely. */
function clearChildren(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/** Create the palette panel DOM. */
function createPalettePanel(view: EditorView): Panel {
  const dom = document.createElement('div');
  dom.className = 'cm-command-palette';

  // Backdrop for click-to-dismiss
  const backdrop = document.createElement('div');
  backdrop.className = 'cm-command-palette-backdrop';
  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    closePalette(view);
  });

  const container = document.createElement('div');
  container.className = 'cm-command-palette-container';

  const input = document.createElement('input');
  input.className = 'cm-command-palette-input';
  input.type = 'text';
  input.placeholder = 'Type a command...';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', 'Command palette');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-controls', 'cm-palette-results');

  const resultsList = document.createElement('ul');
  resultsList.className = 'cm-command-palette-results';
  resultsList.setAttribute('role', 'listbox');
  resultsList.id = 'cm-palette-results';

  container.appendChild(input);
  container.appendChild(resultsList);
  dom.appendChild(backdrop);
  dom.appendChild(container);

  let selectedIndex = 0;
  let filteredCommands: PaletteCommand[] = [];

  function getAllCommands(): PaletteCommand[] {
    const extra = view.state.field(extraCommandsField);
    return [...extra, ...defaultCommands()];
  }

  function renderResults() {
    const query = input.value;
    const allCommands = getAllCommands();
    filteredCommands = filterCommands(allCommands, query);

    // Clamp selected index
    if (selectedIndex >= filteredCommands.length) {
      selectedIndex = Math.max(0, filteredCommands.length - 1);
    }

    // Clear previous results safely (no innerHTML)
    clearChildren(resultsList);

    if (filteredCommands.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'cm-command-palette-empty';
      empty.textContent = 'No matching commands';
      resultsList.appendChild(empty);
      return;
    }

    input.setAttribute('aria-activedescendant', `cm-palette-option-${selectedIndex}`);

    filteredCommands.forEach((cmd, i) => {
      const li = document.createElement('li');
      li.className = 'cm-command-palette-item';
      li.id = `cm-palette-option-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
      if (i === selectedIndex) {
        li.classList.add('cm-command-palette-item-selected');
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'cm-command-palette-label';
      labelSpan.textContent = cmd.label;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'cm-command-palette-meta';

      const categorySpan = document.createElement('span');
      categorySpan.className = 'cm-command-palette-category';
      categorySpan.textContent = cmd.category;
      metaSpan.appendChild(categorySpan);

      if (cmd.shortcut) {
        const shortcutSpan = document.createElement('span');
        shortcutSpan.className = 'cm-command-palette-shortcut';
        shortcutSpan.textContent = cmd.shortcut;
        metaSpan.appendChild(shortcutSpan);
      }

      li.appendChild(labelSpan);
      li.appendChild(metaSpan);

      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        executeCommand(cmd);
      });

      li.addEventListener('mousemove', () => {
        if (selectedIndex !== i) {
          selectedIndex = i;
          renderResults();
        }
      });

      resultsList.appendChild(li);
    });

    // Scroll selected item into view (guard for environments without scrollIntoView)
    const selectedEl = resultsList.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function executeCommand(cmd: PaletteCommand) {
    closePalette(view);
    cmd.execute(view);
  }

  input.addEventListener('input', () => {
    selectedIndex = 0;
    renderResults();
  });

  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filteredCommands.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredCommands.length;
          renderResults();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filteredCommands.length > 0) {
          selectedIndex =
            (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
          renderResults();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closePalette(view);
        break;
    }
  });

  // Initial render
  renderResults();

  return {
    dom,
    top: true,
    mount() { input.focus(); },
  };
}

/** Base theme for the command palette. */
const paletteTheme = EditorView.baseTheme({
  '.cm-command-palette': {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '1000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '60px',
  },
  '.cm-command-palette-backdrop': {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  '.cm-command-palette-container': {
    position: 'relative',
    width: '500px',
    maxWidth: '90vw',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
  },
  '.cm-command-palette-input': {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: 'inherit',
    border: 'none',
    borderBottom: '1px solid #e0e0e0',
    outline: 'none',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    boxSizing: 'border-box',
  },
  '.cm-command-palette-input::placeholder': {
    color: '#999',
  },
  '.cm-command-palette-results': {
    listStyle: 'none',
    margin: '0',
    padding: '4px 0',
    maxHeight: '320px',
    overflowY: 'auto',
  },
  '.cm-command-palette-item': {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: 'pointer',
    color: '#1a1a1a',
  },
  '.cm-command-palette-item-selected': {
    backgroundColor: '#3b82f615',
  },
  '.cm-command-palette-label': {
    fontSize: '14px',
    fontWeight: '500',
  },
  '.cm-command-palette-meta': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.cm-command-palette-category': {
    fontSize: '12px',
    color: '#888',
  },
  '.cm-command-palette-shortcut': {
    fontSize: '12px',
    color: '#888',
    backgroundColor: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'system-ui, sans-serif',
  },
  '.cm-command-palette-empty': {
    padding: '16px',
    textAlign: 'center',
    color: '#888',
    fontSize: '14px',
  },

  // Dark mode overrides
  '&dark .cm-command-palette-backdrop': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  '&dark .cm-command-palette-container': {
    backgroundColor: '#1e1e2e',
    border: '1px solid #45475a',
  },
  '&dark .cm-command-palette-input': {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    borderBottom: '1px solid #45475a',
  },
  '&dark .cm-command-palette-input::placeholder': {
    color: '#6c7086',
  },
  '&dark .cm-command-palette-item': {
    color: '#cdd6f4',
  },
  '&dark .cm-command-palette-item-selected': {
    backgroundColor: '#31324440',
  },
  '&dark .cm-command-palette-category': {
    color: '#6c7086',
  },
  '&dark .cm-command-palette-shortcut': {
    color: '#a6adc8',
    backgroundColor: '#313244',
  },
  '&dark .cm-command-palette-empty': {
    color: '#6c7086',
  },
});

/** The command palette keybinding. */
const paletteKeymap = keymap.of([
  { key: 'Mod-Shift-p', run: showCommandPalette },
]);

/** Complete command palette extension. Include this in your editor setup. */
export function commandPaletteExtension() {
  return [paletteState, extraCommandsField, paletteKeymap, paletteTheme];
}
