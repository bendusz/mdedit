import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';
import {
  defaultCommands,
  filterCommands,
  fuzzyMatch,
  type PaletteCommand,
} from '../src/command-palette/commands';
import {
  showCommandPalette,
  registerPaletteCommands,
} from '../src/command-palette/palette-extension';

describe('command palette', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    view = createEditor({ parent: container, content: 'hello world' });
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  describe('defaultCommands', () => {
    it('returns an array of commands', () => {
      const cmds = defaultCommands();
      expect(Array.isArray(cmds)).toBe(true);
      expect(cmds.length).toBeGreaterThan(0);
    });

    it('includes all toolbar commands', () => {
      const cmds = defaultCommands();
      const ids = cmds.map((c) => c.id);

      expect(ids).toContain('bold');
      expect(ids).toContain('italic');
      expect(ids).toContain('strikethrough');
      expect(ids).toContain('insert-link');
      expect(ids).toContain('insert-image');
      expect(ids).toContain('heading-1');
      expect(ids).toContain('heading-2');
      expect(ids).toContain('heading-3');
      expect(ids).toContain('heading-4');
      expect(ids).toContain('heading-5');
      expect(ids).toContain('heading-6');
      expect(ids).toContain('code-block');
      expect(ids).toContain('horizontal-rule');
      expect(ids).toContain('table');
      expect(ids).toContain('bullet-list');
      expect(ids).toContain('task-list');
    });

    it('all commands have required fields', () => {
      const cmds = defaultCommands();
      for (const cmd of cmds) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.label).toBeTruthy();
        expect(cmd.category).toBeTruthy();
        expect(typeof cmd.execute).toBe('function');
      }
    });

    it('formatting commands have shortcuts', () => {
      const cmds = defaultCommands();
      const bold = cmds.find((c) => c.id === 'bold');
      const italic = cmds.find((c) => c.id === 'italic');
      const link = cmds.find((c) => c.id === 'insert-link');

      expect(bold?.shortcut).toBeTruthy();
      expect(italic?.shortcut).toBeTruthy();
      expect(link?.shortcut).toBeTruthy();
    });

    it('has correct categories', () => {
      const cmds = defaultCommands();
      const categories = new Set(cmds.map((c) => c.category));
      expect(categories).toContain('Formatting');
      expect(categories).toContain('Headings');
      expect(categories).toContain('Blocks');
      expect(categories).toContain('Lists');
    });
  });

  describe('fuzzyMatch', () => {
    it('matches exact prefix', () => {
      expect(fuzzyMatch('bol', 'Bold')).toBeGreaterThanOrEqual(0);
    });

    it('matches case-insensitively', () => {
      expect(fuzzyMatch('BOLD', 'bold')).toBeGreaterThanOrEqual(0);
    });

    it('matches scattered characters', () => {
      expect(fuzzyMatch('hrl', 'Horizontal Rule')).toBeGreaterThanOrEqual(0);
    });

    it('returns -1 for non-matching query', () => {
      expect(fuzzyMatch('xyz', 'Bold')).toBe(-1);
    });

    it('returns 0 for empty query', () => {
      expect(fuzzyMatch('', 'anything')).toBe(0);
    });

    it('returns -1 when query is longer than target', () => {
      expect(fuzzyMatch('abcdef', 'abc')).toBe(-1);
    });
  });

  describe('filterCommands', () => {
    it('returns all commands for empty query', () => {
      const cmds = defaultCommands();
      const filtered = filterCommands(cmds, '');
      expect(filtered.length).toBe(cmds.length);
    });

    it('filters by label', () => {
      const cmds = defaultCommands();
      const filtered = filterCommands(cmds, 'bold');
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered[0].id).toBe('bold');
    });

    it('filters by category and label', () => {
      const cmds = defaultCommands();
      const filtered = filterCommands(cmds, 'heading');
      expect(filtered.length).toBe(6); // H1-H6
    });

    it('returns empty for non-matching query', () => {
      const cmds = defaultCommands();
      const filtered = filterCommands(cmds, 'zzzzz');
      expect(filtered.length).toBe(0);
    });

    it('ranks better matches first', () => {
      const cmds = defaultCommands();
      const filtered = filterCommands(cmds, 'bold');
      // "Bold" should be the first match since it's exact
      expect(filtered[0].label).toBe('Bold');
    });
  });

  describe('command execution', () => {
    it('bold command wraps text', () => {
      view.dispatch({
        selection: { anchor: 0, head: 5 }, // select "hello"
      });
      const cmds = defaultCommands();
      const bold = cmds.find((c) => c.id === 'bold')!;
      bold.execute(view);
      expect(view.state.doc.toString()).toBe('**hello** world');
    });

    it('italic command wraps text', () => {
      view.dispatch({
        selection: { anchor: 0, head: 5 },
      });
      const cmds = defaultCommands();
      const italic = cmds.find((c) => c.id === 'italic')!;
      italic.execute(view);
      expect(view.state.doc.toString()).toBe('*hello* world');
    });

    it('heading command prepends #', () => {
      const cmds = defaultCommands();
      const h1 = cmds.find((c) => c.id === 'heading-1')!;
      h1.execute(view);
      expect(view.state.doc.toString()).toBe('# hello world');
    });

    it('code block command inserts fenced block', () => {
      view.dispatch({ selection: { anchor: 0 } });
      const cmds = defaultCommands();
      const codeBlock = cmds.find((c) => c.id === 'code-block')!;
      codeBlock.execute(view);
      expect(view.state.doc.toString()).toContain('```');
    });

    it('table command inserts table', () => {
      // Move to end so we get a clean insert
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      const cmds = defaultCommands();
      const table = cmds.find((c) => c.id === 'table')!;
      table.execute(view);
      expect(view.state.doc.toString()).toContain('| Header |');
    });

    it('bullet list command adds prefix', () => {
      view.dispatch({ selection: { anchor: 0 } });
      const cmds = defaultCommands();
      const list = cmds.find((c) => c.id === 'bullet-list')!;
      list.execute(view);
      expect(view.state.doc.toString()).toBe('- hello world');
    });

    it('task list command adds prefix', () => {
      view.dispatch({ selection: { anchor: 0 } });
      const cmds = defaultCommands();
      const taskList = cmds.find((c) => c.id === 'task-list')!;
      taskList.execute(view);
      expect(view.state.doc.toString()).toBe('- [ ] hello world');
    });
  });

  describe('showCommandPalette', () => {
    /** CM6 panels live inside .cm-panels which is inside .cm-editor, so search from the editor root. */
    function editorRoot(): HTMLElement {
      return container.querySelector('.cm-editor') as HTMLElement;
    }

    it('opens the palette panel', () => {
      showCommandPalette(view);
      const panel = editorRoot().querySelector('.cm-command-palette');
      expect(panel).toBeTruthy();
    });

    it('shows an input field', () => {
      showCommandPalette(view);
      const input = editorRoot().querySelector('.cm-command-palette-input');
      expect(input).toBeTruthy();
    });

    it('shows command results', () => {
      showCommandPalette(view);
      const items = editorRoot().querySelectorAll('.cm-command-palette-item');
      expect(items.length).toBeGreaterThan(0);
    });

    it('closes on Escape key', () => {
      showCommandPalette(view);
      const input = editorRoot().querySelector('.cm-command-palette-input') as HTMLInputElement;
      expect(input).toBeTruthy();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const panel = editorRoot().querySelector('.cm-command-palette');
      expect(panel).toBeNull();
    });
  });

  describe('registerPaletteCommands', () => {
    function editorRoot(): HTMLElement {
      return container.querySelector('.cm-editor') as HTMLElement;
    }

    it('adds extra commands to the palette', () => {
      const extraCmd: PaletteCommand = {
        id: 'test-cmd',
        label: 'Test Command',
        category: 'Test',
        execute: () => {},
      };
      registerPaletteCommands(view, [extraCmd]);
      showCommandPalette(view);

      const items = editorRoot().querySelectorAll('.cm-command-palette-item');
      const labels = Array.from(items).map((el) => {
        const labelEl = el.querySelector('.cm-command-palette-label');
        return labelEl?.textContent;
      });
      expect(labels).toContain('Test Command');
    });
  });
});
