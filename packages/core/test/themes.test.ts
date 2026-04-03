import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  lightTheme,
  darkTheme,
  solarizedLight,
  solarizedDark,
  nordDark,
  sepiaLight,
  themes,
  themeList,
  getTheme,
  isThemeDark,
  type ThemeId,
} from '../src/theme';
import { createEditor, setEditorTheme } from '../src/editor';
import { EditorView } from '@codemirror/view';

describe('theme registry', () => {
  it('exports all six theme extensions', () => {
    expect(lightTheme).toBeDefined();
    expect(darkTheme).toBeDefined();
    expect(solarizedLight).toBeDefined();
    expect(solarizedDark).toBeDefined();
    expect(nordDark).toBeDefined();
    expect(sepiaLight).toBeDefined();
  });

  it('themes record contains an entry for every ThemeId in themeList', () => {
    for (const entry of themeList) {
      expect(themes[entry.id]).toBeDefined();
    }
  });

  it('themeList has correct length', () => {
    expect(themeList).toHaveLength(6);
  });

  it('getTheme returns a valid extension for each ID', () => {
    const ids: ThemeId[] = ['light', 'dark', 'solarized-light', 'solarized-dark', 'nord', 'sepia'];
    for (const id of ids) {
      const ext = getTheme(id);
      expect(ext).toBeDefined();
    }
  });

  it('getTheme returns the same extension as the themes record', () => {
    for (const entry of themeList) {
      expect(getTheme(entry.id)).toBe(themes[entry.id]);
    }
  });

  it('isThemeDark returns correct values', () => {
    expect(isThemeDark('light')).toBe(false);
    expect(isThemeDark('dark')).toBe(true);
    expect(isThemeDark('solarized-light')).toBe(false);
    expect(isThemeDark('solarized-dark')).toBe(true);
    expect(isThemeDark('nord')).toBe(true);
    expect(isThemeDark('sepia')).toBe(false);
  });

  it('themeList isDark values are consistent with isThemeDark', () => {
    for (const entry of themeList) {
      expect(entry.isDark).toBe(isThemeDark(entry.id));
    }
  });

  it('themeList entries have non-empty labels', () => {
    for (const entry of themeList) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

describe('setEditorTheme backward compatibility', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    view = createEditor({ parent: container, content: '' });
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('accepts boolean true (dark)', () => {
    expect(() => setEditorTheme(view, true)).not.toThrow();
  });

  it('accepts boolean false (light)', () => {
    expect(() => setEditorTheme(view, false)).not.toThrow();
  });

  it('accepts a ThemeId string', () => {
    expect(() => setEditorTheme(view, 'solarized-light')).not.toThrow();
    expect(() => setEditorTheme(view, 'nord')).not.toThrow();
    expect(() => setEditorTheme(view, 'sepia')).not.toThrow();
    expect(() => setEditorTheme(view, 'solarized-dark')).not.toThrow();
  });
});
