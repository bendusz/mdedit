/** Reactive file state store using Svelte 5 runes. */

import { detectLineSeparator, type LineSeparator } from '@mdedit/core';

let path = $state<string | null>(null);
let filename = $state<string | null>(null);
let isDirty = $state(false);
let content = $state('');
let revision = $state(0);
let lineSep = $state<LineSeparator>('\n');

export const fileState = {
  get path() {
    return path;
  },
  get filename() {
    return filename;
  },
  get isDirty() {
    return isDirty;
  },
  get content() {
    return content;
  },
  get revision() {
    return revision;
  },
  get lineSeparator() {
    return lineSep;
  },

  /** Set file info after open/save-as. Detects line endings. Clears dirty flag. */
  setFile(filePath: string, fileName: string, fileContent: string) {
    path = filePath;
    filename = fileName;
    lineSep = detectLineSeparator(fileContent);
    content = fileContent;
    isDirty = false;
  },

  /** Update content from editor changes. Marks dirty, increments revision. */
  setContent(newContent: string) {
    content = newContent;
    isDirty = true;
    revision++;
  },

  /** Clear dirty flag only if revision matches (prevents stale autosave races). */
  markSaved(atRevision: number) {
    if (revision === atRevision) {
      isDirty = false;
    }
  },

  /** Reset to empty/new-file state. */
  reset() {
    path = null;
    filename = null;
    content = '';
    isDirty = false;
    revision = 0;
  },
};
