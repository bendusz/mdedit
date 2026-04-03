import type { KeyBinding } from '@codemirror/view';
import { toggleBold, toggleItalic, toggleStrikethrough, insertLink, insertCodeBlock } from './commands';

export const markdownKeybindings: KeyBinding[] = [
  { key: 'Mod-b', run: (view) => { toggleBold(view); return true; } },
  { key: 'Mod-i', run: (view) => { toggleItalic(view); return true; } },
  { key: 'Mod-Shift-x', run: (view) => { toggleStrikethrough(view); return true; } },
  { key: 'Mod-k', run: (view) => { insertLink(view); return true; } },
  { key: 'Mod-Shift-c', run: (view) => { insertCodeBlock(view); return true; } },
];
