<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import { fileState } from '$lib/stores/fileState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import {
    acceptPendingFile,
    addToRecent,
    clearCurrentFile,
    openFileDialog,
    saveCurrentFile,
    saveFileAsDialog,
    type FileData,
  } from '$lib/tauri/fileOps';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { listen } from '@tauri-apps/api/event';
  import { setEditorTheme, setContentWidth, registerPaletteCommands, getOutline, type CursorInfo, type PaletteCommand, type OutlineEntry } from '@mdedit/core';
  import { EditorView } from '@mdedit/core';
  import OutlineSidebar from '$lib/components/OutlineSidebar.svelte';
  import { contentWidthState } from '$lib/stores/contentWidth.svelte';

  let editor: Editor;
  let cursorLine = $state(1);
  let cursorCol = $state(1);
  let wordCount = $state(0);
  let showOutline = $state(false);
  let outlineEntries: OutlineEntry[] = $state([]);

  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const WELCOME_CONTENT = '# Welcome to mdedit\n\nStart typing your markdown here.';

  function directoryOf(filePath: string | null): string {
    if (!filePath) {
      return '';
    }
    return filePath.replace(/[\\/][^\\/]*$/, '');
  }

  function applyLoadedFile(data: FileData) {
    fileState.setFile(data.path, data.filename, data.content);
    editor.setFileBasePath(directoryOf(data.path));
    editor.loadFile(data.content);
    updateOutline();
  }

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (fileState.isDirty && fileState.path) {
        const rev = fileState.revision;
        try {
          await saveCurrentFile(contentForSave());
          fileState.markSaved(rev);
        } catch (e) {
          console.error('Auto-save failed:', e);
        }
      }
    }, 2000);
  }

  function getEditorView() {
    return editor?.getView();
  }

  function onDocChange(content: string) {
    fileState.setContent(content);
    scheduleAutoSave();
    updateOutline();
  }

  function updateOutline() {
    const view = getEditorView();
    if (view) {
      outlineEntries = getOutline(view.state);
    }
  }

  function handleOutlineEntryClick(entry: OutlineEntry) {
    const view = getEditorView();
    if (view) {
      view.dispatch({
        selection: { anchor: entry.from },
        effects: EditorView.scrollIntoView(entry.from, { y: 'start', yMargin: 20 }),
      });
      view.focus();
    }
  }

  function toggleOutline() {
    showOutline = !showOutline;
    if (showOutline) {
      updateOutline();
    }
  }

  function onSelectionChange(info: CursorInfo) {
    cursorLine = info.line;
    cursorCol = info.col;
    wordCount = info.wordCount;
    updateOutline();
  }

  async function saveCurrentDocumentBeforeSwitch(): Promise<boolean> {
    if (!fileState.isDirty) {
      return true;
    }

    const rev = fileState.revision;

    if (fileState.path) {
      try {
        await saveCurrentFile(contentForSave());
        fileState.markSaved(rev);
        return true;
      } catch (e) {
        console.error('Failed to save file before switching:', e);
        return false;
      }
    }

    try {
      const result = await saveFileAsDialog(contentForSave());
      if (!result) {
        return false;
      }

      fileState.setFile(result.path, result.filename, result.content);
      editor.setFileBasePath(directoryOf(result.path));
      fileState.markSaved(rev);
      return true;
    } catch (e) {
      console.error('Failed to save file before switching:', e);
      return false;
    }
  }

  async function handleOpen() {
    if (!(await saveCurrentDocumentBeforeSwitch())) {
      return;
    }

    try {
      const result = await openFileDialog();
      if (result) {
        applyLoadedFile(result);
        try {
          await addToRecent(result.path);
        } catch (recentError) {
          console.error('Failed to update recent files:', recentError);
        }
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  /** Get content with original line endings restored for saving. */
  function contentForSave(): string {
    if (fileState.lineSeparator === '\r\n') {
      return fileState.content.replace(/\n/g, '\r\n');
    }
    return fileState.content;
  }

  async function handleSave() {
    if (!fileState.path) {
      return handleSaveAs();
    }
    const rev = fileState.revision;
    try {
      await saveCurrentFile(contentForSave());
      fileState.markSaved(rev);
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  }

  async function handleSaveAs() {
    const rev = fileState.revision;
    try {
      const result = await saveFileAsDialog(contentForSave());
      if (result) {
        fileState.setFile(result.path, result.filename, result.content);
        editor.setFileBasePath(directoryOf(result.path));
        fileState.markSaved(rev);
      }
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  }

  async function handleNew() {
    if (!(await saveCurrentDocumentBeforeSwitch())) {
      return;
    }

    fileState.reset();
    editor.setFileBasePath('');
    editor.loadFile(WELCOME_CONTENT);
    updateOutline();
    try {
      await clearCurrentFile();
    } catch (e) {
      console.error('Failed to clear current file:', e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && e.shiftKey && key === 'o') {
      e.preventDefault();
      toggleOutline();
    } else if (mod && e.shiftKey && key === 's') {
      e.preventDefault();
      void handleSaveAs();
    } else if (mod && key === 'o') {
      e.preventDefault();
      void handleOpen();
    } else if (mod && key === 's') {
      e.preventDefault();
      void handleSave();
    } else if (mod && key === 'n') {
      e.preventDefault();
      void handleNew();
    }
  }

  $effect(() => {
    const dot = fileState.isDirty ? '\u25CF ' : '';
    const name = fileState.filename ?? 'Untitled';
    getCurrentWindow().setTitle(`${dot}${name} \u2014 mdedit`);
  });

  $effect(() => {
    const dark = themeState.isDark;
    document.documentElement.classList.toggle('dark', dark);
    const view = getEditorView();
    if (view) {
      setEditorTheme(view, dark);
    }
  });

  $effect(() => {
    const width = contentWidthState.width;
    const view = getEditorView();
    if (view) {
      setContentWidth(view, width);
    }
  });

  /** Open a Rust-owned external file payload, used by drag-drop and file association. */
  async function handleOpenExternalFile(data: FileData) {
    if (!(await saveCurrentDocumentBeforeSwitch())) {
      return;
    }

    try {
      await acceptPendingFile(data.path);
      applyLoadedFile(data);
      try {
        await addToRecent(data.path);
      } catch (recentError) {
        console.error('Failed to update recent files:', recentError);
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  let unlistenMenu: (() => void) | null = null;
  let unlistenOpenFile: (() => void) | null = null;
  let unlistenClose: (() => void) | null = null;

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown);

    // Register app-level commands in the command palette
    const view = getEditorView();
    if (view) {
      const appCommands: PaletteCommand[] = [
        { id: 'file-new', label: 'New File', category: 'File', shortcut: '\u2318N', execute: () => { void handleNew(); } },
        { id: 'file-open', label: 'Open File', category: 'File', shortcut: '\u2318O', execute: () => { void handleOpen(); } },
        { id: 'file-save', label: 'Save', category: 'File', shortcut: '\u2318S', execute: () => { void handleSave(); } },
        { id: 'file-save-as', label: 'Save As...', category: 'File', shortcut: '\u2318\u21E7S', execute: () => { void handleSaveAs(); } },
        { id: 'view-toggle-outline', label: 'Toggle Outline', category: 'View', shortcut: '\u2318\u21E7O', execute: () => { toggleOutline(); } },
      ];
      registerPaletteCommands(view, appCommands);
      updateOutline();
    }

    unlistenMenu = await listen<string>('menu-event', (event) => {
      switch (event.payload) {
        case 'new': void handleNew(); break;
        case 'open': void handleOpen(); break;
        case 'save': void handleSave(); break;
        case 'save_as': void handleSaveAs(); break;
      }
    });

    // Listen for files opened via OS file association or drag-drop.
    unlistenOpenFile = await listen<FileData>('open-file', (event) => {
      void handleOpenExternalFile(event.payload);
    });

    // Guard against closing with unsaved changes — auto-save before quit
    const currentWindow = getCurrentWindow();
    unlistenClose = await currentWindow.onCloseRequested(async (event) => {
      if (fileState.isDirty) {
        event.preventDefault();

        if (fileState.path) {
          // File has a path — try to auto-save before closing
          try {
            const rev = fileState.revision;
            await saveCurrentFile(contentForSave());
            fileState.markSaved(rev);
            await currentWindow.destroy();
          } catch (e) {
            // Save failed — keep window open so user doesn't lose work
            console.error('Failed to save on close:', e);
          }
        } else {
          // Untitled dirty document — offer Save As dialog
          try {
            const result = await saveFileAsDialog(contentForSave());
            if (result) {
              // Saved successfully — close
              fileState.setFile(result.path, result.filename, fileState.content);
              await currentWindow.destroy();
            }
            // If user cancelled Save As, window stays open (event was prevented)
          } catch (e) {
            console.error('Failed to save on close:', e);
          }
        }
      }
    });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    unlistenMenu?.();
    unlistenOpenFile?.();
    unlistenClose?.();
  });
</script>

<main class="app">
  <Toolbar {getEditorView} />
  <div class="editor-area">
    <Editor bind:this={editor} {onDocChange} {onSelectionChange} />
    <OutlineSidebar entries={outlineEntries} visible={showOutline} onEntryClick={handleOutlineEntryClick} />
  </div>
  <StatusBar line={cursorLine} col={cursorCol} {wordCount} isDirty={fileState.isDirty} contentWidth={contentWidthState.width} onContentWidthChange={(w) => contentWidthState.setWidth(w)} />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .editor-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
</style>
