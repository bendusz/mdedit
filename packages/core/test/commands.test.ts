import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { createEditor, setReadOnly } from '../src/editor';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  insertLink,
  insertImage,
  setHeading,
  toggleList,
  toggleTaskList,
  insertCodeBlock,
  insertHorizontalRule,
  insertTable,
} from '../src/toolbar/commands';

describe('toolbar commands', () => {
  let container: HTMLElement;
  let view: EditorView;

  function createWithContent(content: string, cursorPos: number): EditorView {
    view = createEditor({ parent: container, content });
    view.dispatch({ selection: { anchor: cursorPos } });
    return view;
  }

  function selectRange(from: number, to: number) {
    view.dispatch({ selection: EditorSelection.range(from, to) });
  }

  function docText(): string {
    return view.state.doc.toString();
  }

  function cursorPos(): number {
    return view.state.selection.main.head;
  }

  function selectionRange(): { from: number; to: number } {
    const sel = view.state.selection.main;
    return { from: sel.from, to: sel.to };
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  // --- toggleBold ---

  describe('toggleBold', () => {
    it('should wrap selected text in **', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      toggleBold(view);
      expect(docText()).toBe('**hello** world');
    });

    it('should unwrap already bold text', () => {
      createWithContent('**hello** world', 0);
      selectRange(2, 7); // select "hello" inside the **
      toggleBold(view);
      expect(docText()).toBe('hello world');
    });

    it('should insert bold placeholder when no selection', () => {
      createWithContent('text ', 5);
      toggleBold(view);
      expect(docText()).toBe('text **bold**');
      // "bold" should be selected
      const sel = selectionRange();
      expect(sel.from).toBe(7);
      expect(sel.to).toBe(11);
    });
  });

  // --- toggleItalic ---

  describe('toggleItalic', () => {
    it('should wrap selected text in *', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      toggleItalic(view);
      expect(docText()).toBe('*hello* world');
    });

    it('should unwrap already italic text', () => {
      createWithContent('*hello* world', 0);
      selectRange(1, 6); // select "hello" inside the *
      toggleItalic(view);
      expect(docText()).toBe('hello world');
    });

    it('should insert italic placeholder when no selection', () => {
      createWithContent('', 0);
      toggleItalic(view);
      expect(docText()).toBe('*italic*');
      const sel = selectionRange();
      expect(sel.from).toBe(1);
      expect(sel.to).toBe(7);
    });
  });

  // --- toggleStrikethrough ---

  describe('toggleStrikethrough', () => {
    it('should wrap selected text in ~~', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      toggleStrikethrough(view);
      expect(docText()).toBe('~~hello~~ world');
    });

    it('should unwrap already strikethrough text', () => {
      createWithContent('~~hello~~ world', 0);
      selectRange(2, 7);
      toggleStrikethrough(view);
      expect(docText()).toBe('hello world');
    });

    it('should insert strikethrough placeholder when no selection', () => {
      createWithContent('', 0);
      toggleStrikethrough(view);
      expect(docText()).toBe('~~strikethrough~~');
      const sel = selectionRange();
      expect(sel.from).toBe(2);
      expect(sel.to).toBe(15);
    });
  });

  // --- insertLink ---

  describe('insertLink', () => {
    it('should wrap selected text as link text', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      insertLink(view);
      expect(docText()).toBe('[hello](url) world');
      // "url" should be selected
      const sel = selectionRange();
      expect(sel.from).toBe(8);
      expect(sel.to).toBe(11);
    });

    it('should insert link template when no selection', () => {
      createWithContent('', 0);
      insertLink(view);
      expect(docText()).toBe('[link text](url)');
      // "url" should be selected
      const sel = selectionRange();
      expect(sel.from).toBe(13);
      expect(sel.to).toBe(16);
    });
  });

  // --- insertImage ---

  describe('insertImage', () => {
    it('should wrap selected text as alt text', () => {
      createWithContent('photo', 0);
      selectRange(0, 5);
      insertImage(view);
      expect(docText()).toBe('![photo](image-url)');
      // "image-url" should be selected
      const sel = selectionRange();
      expect(sel.from).toBe(9);
      expect(sel.to).toBe(18);
    });

    it('should insert image template when no selection', () => {
      createWithContent('', 0);
      insertImage(view);
      expect(docText()).toBe('![alt](image-url)');
      // "image-url" should be selected
      const sel = selectionRange();
      expect(sel.from).toBe(7);
      expect(sel.to).toBe(16);
    });
  });

  // --- setHeading ---

  describe('setHeading', () => {
    it('should prepend # for heading level 1', () => {
      createWithContent('Hello', 0);
      setHeading(view, 1);
      expect(docText()).toBe('# Hello');
    });

    it('should prepend ## for heading level 2', () => {
      createWithContent('Hello', 0);
      setHeading(view, 2);
      expect(docText()).toBe('## Hello');
    });

    it('should replace existing heading level', () => {
      createWithContent('## Hello', 3);
      setHeading(view, 1);
      expect(docText()).toBe('# Hello');
    });

    it('should replace h1 with h3', () => {
      createWithContent('# Hello', 2);
      setHeading(view, 3);
      expect(docText()).toBe('### Hello');
    });

    it('should remove heading when level is 0', () => {
      createWithContent('## Hello', 3);
      setHeading(view, 0);
      expect(docText()).toBe('Hello');
    });

    it('should work on the correct line when cursor is mid-document', () => {
      createWithContent('Line one\nLine two\nLine three', 14);
      setHeading(view, 2);
      expect(docText()).toBe('Line one\n## Line two\nLine three');
    });
  });

  // --- toggleList ---

  describe('toggleList', () => {
    it('should add list prefix to a plain line', () => {
      createWithContent('Item one', 0);
      toggleList(view);
      expect(docText()).toBe('- Item one');
    });

    it('should remove list prefix from a list line', () => {
      createWithContent('- Item one', 2);
      toggleList(view);
      expect(docText()).toBe('Item one');
    });

    it('should work on the correct line in a multi-line document', () => {
      createWithContent('First\nSecond\nThird', 8);
      toggleList(view);
      expect(docText()).toBe('First\n- Second\nThird');
    });
  });

  // --- toggleTaskList ---

  describe('toggleTaskList', () => {
    it('should add task list prefix to a plain line', () => {
      createWithContent('Task', 0);
      toggleTaskList(view);
      expect(docText()).toBe('- [ ] Task');
    });

    it('should remove task list prefix', () => {
      createWithContent('- [ ] Task', 6);
      toggleTaskList(view);
      expect(docText()).toBe('Task');
    });

    it('should upgrade a plain list item to a task list item', () => {
      createWithContent('- Task', 2);
      toggleTaskList(view);
      expect(docText()).toBe('- [ ] Task');
    });
  });

  // --- insertCodeBlock ---

  describe('insertCodeBlock', () => {
    it('should insert an empty fenced code block', () => {
      createWithContent('', 0);
      insertCodeBlock(view);
      expect(docText()).toBe('```\n\n```');
      // Cursor should be on the empty line inside
      expect(cursorPos()).toBe(4);
    });

    it('should wrap selected text in a fenced code block', () => {
      createWithContent('const x = 1;', 0);
      selectRange(0, 12);
      insertCodeBlock(view);
      expect(docText()).toBe('```\nconst x = 1;\n```');
      // Cursor should be at position 3 (end of opening ```)
      expect(cursorPos()).toBe(3);
    });
  });

  // --- insertHorizontalRule ---

  describe('insertHorizontalRule', () => {
    it('should insert --- on an empty line', () => {
      createWithContent('', 0);
      insertHorizontalRule(view);
      expect(docText()).toBe('---\n');
      // Cursor on the --- line so live preview shows raw markdown
      expect(cursorPos()).toBe(0);
    });

    it('should insert --- after the current line when not empty', () => {
      createWithContent('Some text', 4);
      insertHorizontalRule(view);
      expect(docText()).toBe('Some text\n---\n');
      // Cursor on the --- line
      expect(cursorPos()).toBe(10);
    });
  });

  // --- insertTable ---

  describe('insertTable', () => {
    it('should insert a 3-column table on an empty line', () => {
      createWithContent('', 0);
      insertTable(view);
      const expected = [
        '| Header | Header | Header |',
        '| ------ | ------ | ------ |',
        '| Cell   | Cell   | Cell   |',
        '| Cell   | Cell   | Cell   |',
        '| Cell   | Cell   | Cell   |',
        '',
      ].join('\n');
      expect(docText()).toBe(expected);
    });

    it('should insert a table after the current line when not empty', () => {
      createWithContent('Some text', 4);
      insertTable(view);
      const expected = [
        'Some text',
        '| Header | Header | Header |',
        '| ------ | ------ | ------ |',
        '| Cell   | Cell   | Cell   |',
        '| Cell   | Cell   | Cell   |',
        '| Cell   | Cell   | Cell   |',
        '',
      ].join('\n');
      expect(docText()).toBe(expected);
    });

    it('should select the first "Header" text', () => {
      createWithContent('', 0);
      insertTable(view);
      const sel = selectionRange();
      // "Header" starts at position 2 (after "| ")
      expect(sel.from).toBe(2);
      expect(sel.to).toBe(8);
      expect(view.state.sliceDoc(sel.from, sel.to)).toBe('Header');
    });
  });

  describe('read-only mode', () => {
    it('should ignore editing commands while the editor is read-only', () => {
      const commands = [
        () => toggleBold(view),
        () => toggleItalic(view),
        () => toggleStrikethrough(view),
        () => insertLink(view),
        () => insertImage(view),
        () => setHeading(view, 2),
        () => toggleList(view),
        () => toggleTaskList(view),
        () => insertCodeBlock(view),
        () => insertHorizontalRule(view),
        () => insertTable(view),
      ];

      for (const run of commands) {
        createWithContent('hello', 0);
        setReadOnly(view, true);

        run();

        expect(docText()).toBe('hello');

        view.destroy();
      }
    });
  });
});
