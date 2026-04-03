import { Annotation, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { livePreview } from './extensions/live-preview';
import { markdownKeybindings } from './toolbar/keybindings';
import { getCursorInfo, type CursorInfo } from './observers';

export type LineSeparator = '\n' | '\r\n';

export interface EditorConfig {
  parent: HTMLElement;
  content: string;
  onDocChange?: (content: string) => void;
  onSelectionChange?: (info: CursorInfo) => void;
}

/** Annotation to mark transactions that load file content (not user edits). */
export const isFileLoad = Annotation.define<boolean>();

/** Replace the entire editor content, annotated as a file load (skips onDocChange). */
export function loadEditorContent(view: EditorView, newContent: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: newContent },
    annotations: [isFileLoad.of(true)],
  });
}

/** Detect whether the original content uses CRLF or LF line endings. */
export function detectLineSeparator(content: string): LineSeparator {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

export function createEditor(config: EditorConfig): EditorView {
  const { parent, content, onDocChange, onSelectionChange } = config;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onDocChange) {
      const isLoad = update.transactions.some((t) => t.annotation(isFileLoad));
      if (!isLoad) {
        onDocChange(update.state.doc.toString());
      }
    }
    if ((update.docChanged || update.selectionSet) && onSelectionChange) {
      onSelectionChange(getCursorInfo(update.state));
    }
  });

  const state = EditorState.create({
    doc: content,
    extensions: [
      history(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle),
      bracketMatching(),
      search(),
      keymap.of(markdownKeybindings),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      ...livePreview(),
      updateListener,
      EditorView.lineWrapping,
    ],
  });

  return new EditorView({ state, parent });
}
