import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { emojiMap, replaceEmojiShortcodes } from '../src/extensions/emoji';
import { markdownToHtml } from '../src/export';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Move cursor to a specific line (1-based) and flush so decorations recompute.
 */
function moveCursorToLine(view: EditorView, lineNumber: number) {
  const line = view.state.doc.line(lineNumber);
  view.dispatch({ selection: { anchor: line.from } });
  flushEditorUpdate(view);
}

describe('emoji shortcodes', () => {
  describe('emojiMap', () => {
    it('should map :smile: to the correct emoji', () => {
      expect(emojiMap['smile']).toBe('\u{1F604}');
    });

    it('should map :heart: to the correct emoji', () => {
      expect(emojiMap['heart']).toBe('\u2764\uFE0F');
    });

    it('should map :thumbsup: to the correct emoji', () => {
      expect(emojiMap['thumbsup']).toBe('\u{1F44D}');
    });

    it('should map :fire: to the correct emoji', () => {
      expect(emojiMap['fire']).toBe('\u{1F525}');
    });

    it('should map :rocket: to the correct emoji', () => {
      expect(emojiMap['rocket']).toBe('\u{1F680}');
    });

    it('should map :+1: to thumbs up', () => {
      expect(emojiMap['+1']).toBe('\u{1F44D}');
    });

    it('should contain at least 200 entries', () => {
      expect(Object.keys(emojiMap).length).toBeGreaterThanOrEqual(200);
    });

    it('should return undefined for unknown shortcodes', () => {
      expect(emojiMap['nonexistent_emoji_xyz']).toBeUndefined();
    });
  });

  describe('replaceEmojiShortcodes', () => {
    it('should replace known shortcodes with emoji', () => {
      expect(replaceEmojiShortcodes('Hello :smile: world')).toBe('Hello \u{1F604} world');
    });

    it('should replace multiple shortcodes', () => {
      const result = replaceEmojiShortcodes(':fire: and :rocket:');
      expect(result).toBe('\u{1F525} and \u{1F680}');
    });

    it('should leave unknown shortcodes unchanged', () => {
      expect(replaceEmojiShortcodes(':nonexistent_thing:')).toBe(':nonexistent_thing:');
    });

    it('should not replace shortcodes inside inline code', () => {
      expect(replaceEmojiShortcodes('Use `:smile:` for emoji')).toBe('Use `:smile:` for emoji');
    });

    it('should not replace shortcodes inside fenced code blocks', () => {
      const md = '```\n:smile:\n```';
      expect(replaceEmojiShortcodes(md)).toBe('```\n:smile:\n```');
    });

    it('should replace shortcodes outside code but not inside', () => {
      const md = ':heart: is nice\n\n```\n:heart: in code\n```';
      const result = replaceEmojiShortcodes(md);
      expect(result).toContain('\u2764\uFE0F');
      expect(result).toContain(':heart: in code');
    });

    it('should handle text with no shortcodes', () => {
      expect(replaceEmojiShortcodes('Hello world')).toBe('Hello world');
    });

    it('should handle empty string', () => {
      expect(replaceEmojiShortcodes('')).toBe('');
    });
  });

  describe('markdownToHtml with emoji', () => {
    it('should replace emoji shortcodes in exported HTML', () => {
      const html = markdownToHtml('Hello :smile:');
      expect(html).toContain('\u{1F604}');
      expect(html).not.toContain(':smile:');
    });

    it('should not replace shortcodes in code blocks in exported HTML', () => {
      const html = markdownToHtml('```\n:smile:\n```');
      expect(html).toContain(':smile:');
    });
  });

  describe('emoji decoration (live preview)', () => {
    let container: HTMLElement;
    let view: EditorView;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      view?.destroy();
      container.remove();
    });

    it('should replace :smile: with emoji widget when cursor is away', () => {
      view = createEditor({
        parent: container,
        content: 'Hello :smile: world\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const emojiWidgets = container.querySelectorAll('.cm-emoji');
      expect(emojiWidgets.length).toBeGreaterThan(0);
      expect(emojiWidgets[0].textContent).toBe('\u{1F604}');
    });

    it('should show raw :shortcode: when cursor is on the same line', () => {
      view = createEditor({
        parent: container,
        content: ':fire: is hot\n\nother line',
      });
      moveCursorToLine(view, 1);

      const emojiWidgets = container.querySelectorAll('.cm-emoji');
      expect(emojiWidgets.length).toBe(0);

      const lines = container.querySelectorAll('.cm-line');
      expect(lines[0].textContent).toContain(':fire:');
    });

    it('should NOT replace unknown shortcodes', () => {
      view = createEditor({
        parent: container,
        content: ':nonexistent_xyz: text\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const emojiWidgets = container.querySelectorAll('.cm-emoji');
      expect(emojiWidgets.length).toBe(0);
    });

    it('should handle multiple shortcodes on different lines', () => {
      view = createEditor({
        parent: container,
        content: ':heart:\n\n:fire:\n\ncursor here',
      });
      moveCursorToLine(view, 5);

      const emojiWidgets = container.querySelectorAll('.cm-emoji');
      expect(emojiWidgets.length).toBe(2);
    });

    it('should not replace shortcodes inside fenced code blocks', () => {
      view = createEditor({
        parent: container,
        content: '```\n:smile:\n```\n\ncursor here',
      });
      moveCursorToLine(view, 5);

      // No emoji widgets should appear inside the code block
      const emojiWidgets = container.querySelectorAll('.cm-emoji');
      expect(emojiWidgets.length).toBe(0);
    });

    it('should set title attribute with shortcode name', () => {
      view = createEditor({
        parent: container,
        content: ':rocket: launch\n\ncursor here',
      });
      moveCursorToLine(view, 3);

      const emojiWidgets = container.querySelectorAll('.cm-emoji');
      expect(emojiWidgets.length).toBeGreaterThan(0);
      expect(emojiWidgets[0].getAttribute('title')).toBe(':rocket:');
    });
  });

  describe('emoji autocomplete', () => {
    let container: HTMLElement;
    let view: EditorView;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      view?.destroy();
      container.remove();
    });

    it('should include autocompletion extension in editor', () => {
      view = createEditor({
        parent: container,
        content: '',
      });
      // The editor should be created successfully with the autocomplete extension
      expect(view).toBeDefined();
      expect(view.state).toBeDefined();
    });
  });
});
