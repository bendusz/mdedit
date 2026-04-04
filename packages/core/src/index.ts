export {
  createEditor,
  detectLineSeparator,
  isFileLoad,
  loadEditorContent,
  setContentWidth,
  setEditorTheme,
  setFocusHighlight,
  setImageBasePath,
  setReadOnly,
  type EditorConfig,
  type LineSeparator,
} from './editor';

export {
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
  type ThemeInfo,
} from './theme';

export { getCursorInfo, type CursorInfo } from './observers';

export { EditorView } from '@codemirror/view';

export { livePreview, FrontmatterExtension, mermaidWidget, mathWidget, footnoteDecoration, footnoteStyles, emojiDecoration, emojiAutocomplete, emojiMap, replaceEmojiShortcodes, admonitionDecoration, admonitionStyles, parseAdmonitionType, type AdmonitionType } from './extensions/live-preview';
export { clearMermaidCache, mermaidDarkMode } from './extensions/mermaid-widget';
export { clearMathCache } from './extensions/math-widget';

export {
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
} from './toolbar/commands';

export { markdownKeybindings } from './toolbar/keybindings';

export {
  commandPaletteExtension,
  showCommandPalette,
  registerPaletteCommands,
} from './command-palette/palette-extension';

export { defaultCommands, filterCommands, type PaletteCommand } from './command-palette/commands';

export { getOutline, type OutlineEntry } from './outline';

export { markdownToHtml, preprocessAdmonitions } from './export';

export {
  parseTable,
  addColumn,
  removeColumn,
  addRow,
  removeRow,
  type TableInfo,
} from './extensions/table-editor';

export { focusHighlight } from './extensions/focus-highlight';
