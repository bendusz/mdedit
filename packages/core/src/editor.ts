import { EditorState } from '@codemirror/state';
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

export type LineSeparator = '\n' | '\r\n';

export interface EditorConfig {
  parent: HTMLElement;
  content: string;
  onDocChange?: (content: string) => void;
}

/** Detect whether the original content uses CRLF or LF line endings. */
export function detectLineSeparator(content: string): LineSeparator {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

export function createEditor(config: EditorConfig): EditorView {
  const { parent, content, onDocChange } = config;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onDocChange) {
      onDocChange(update.state.doc.toString());
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
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      updateListener,
      EditorView.lineWrapping,
    ],
  });

  return new EditorView({ state, parent });
}
