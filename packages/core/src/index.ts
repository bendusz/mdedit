export {
  createEditor,
  detectLineSeparator,
  isFileLoad,
  loadEditorContent,
  setEditorTheme,
  type EditorConfig,
  type LineSeparator,
} from './editor';

export { lightTheme, darkTheme } from './theme';

export { getCursorInfo, type CursorInfo } from './observers';

export { type EditorView } from '@codemirror/view';

export { livePreview } from './extensions/live-preview';

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
