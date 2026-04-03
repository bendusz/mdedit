import { Annotation, Compartment, EditorState } from '@codemirror/state';
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
import { livePreview, FrontmatterExtension } from './extensions/live-preview';
import { imageBasePath } from './extensions/image-widget';
import { markdownKeybindings } from './toolbar/keybindings';
import { commandPaletteExtension } from './command-palette/palette-extension';
import { getCursorInfo, type CursorInfo } from './observers';
import { lightTheme, darkTheme } from './theme';

const themeCompartment = new Compartment();
const imageBasePathCompartment = new Compartment();
const contentWidthCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

export type LineSeparator = '\n' | '\r\n';

export interface EditorConfig {
  parent: HTMLElement;
  content: string;
  dark?: boolean;
  imageBasePath?: string;
  contentWidth?: string;
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

export function setEditorTheme(view: EditorView, dark: boolean) {
  view.dispatch({
    effects: themeCompartment.reconfigure(dark ? darkTheme : lightTheme),
  });
}

export function setImageBasePath(view: EditorView, basePath: string) {
  view.dispatch({
    effects: imageBasePathCompartment.reconfigure(imageBasePath.of(basePath)),
  });
}

function contentWidthTheme(width: string) {
  return EditorView.theme({
    '.cm-content': { maxWidth: width },
  });
}

export function setContentWidth(view: EditorView, width: string) {
  view.dispatch({
    effects: contentWidthCompartment.reconfigure(contentWidthTheme(width)),
  });
}

/**
 * Toggle reading mode. When readOnly is true the document cannot be edited,
 * the cursor is hidden, but scrolling and text selection still work.
 */
export function setReadOnly(view: EditorView, readOnly: boolean) {
  view.dispatch({
    effects: readOnlyCompartment.reconfigure([
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
    ]),
  });
}

export function createEditor(config: EditorConfig): EditorView {
  const { parent, content, dark, imageBasePath: basePath = '', contentWidth = '80ch', onDocChange, onSelectionChange } = config;

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
      markdown({ base: markdownLanguage, codeLanguages: languages, extensions: FrontmatterExtension }),
      syntaxHighlighting(defaultHighlightStyle),
      bracketMatching(),
      search(),
      keymap.of(markdownKeybindings),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      ...livePreview(),
      ...commandPaletteExtension(),
      themeCompartment.of(dark ? darkTheme : lightTheme),
      imageBasePathCompartment.of(imageBasePath.of(basePath)),
      contentWidthCompartment.of(contentWidthTheme(contentWidth)),
      readOnlyCompartment.of([
        EditorState.readOnly.of(false),
        EditorView.editable.of(true),
      ]),
      updateListener,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
    ],
  });

  return new EditorView({ state, parent });
}
