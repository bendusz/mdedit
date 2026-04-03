export {
  createEditor,
  detectLineSeparator,
  isFileLoad,
  loadEditorContent,
  setContentWidth,
  setEditorTheme,
  setImageBasePath,
  type EditorConfig,
  type LineSeparator,
} from './editor';

export { lightTheme, darkTheme } from './theme';

export { getCursorInfo, type CursorInfo } from './observers';

export { type EditorView } from '@codemirror/view';

export { livePreview, FrontmatterExtension } from './extensions/live-preview';

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

