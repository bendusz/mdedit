<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import { fileState } from '$lib/stores/fileState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import { openFile, openFileDialog, saveFile, saveFileAsDialog, addToRecent } from '$lib/tauri/fileOps';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { listen } from '@tauri-apps/api/event';
  import { setEditorTheme, type CursorInfo } from '@mdedit/core';

  let editor: Editor;
  let cursorLine = $state(1);
  let cursorCol = $state(1);
  let wordCount = $state(0);

  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (fileState.isDirty && fileState.path) {
        const rev = fileState.revision;
        try {
          await saveFile(fileState.path, contentForSave());
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
  }

  function onSelectionChange(info: CursorInfo) {
    cursorLine = info.line;
    cursorCol = info.col;
    wordCount = info.wordCount;
  }

  async function handleOpen() {
    try {
      const result = await openFileDialog();
      if (result) {
        fileState.setFile(result.path, result.filename, result.content);
        editor.loadFile(result.content);
        addToRecent(result.path);
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
      await saveFile(fileState.path, contentForSave());
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
        fileState.markSaved(rev);
      }
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  }

  function handleNew() {
    fileState.reset();
    editor.loadFile('# Welcome to mdedit\n\nStart typing your markdown here.');
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && e.shiftKey && key === 's') {
      e.preventDefault();
      handleSaveAs();
    } else if (mod && key === 'o') {
      e.preventDefault();
      handleOpen();
    } else if (mod && key === 's') {
      e.preventDefault();
      handleSave();
    } else if (mod && key === 'n') {
      e.preventDefault();
      handleNew();
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

  /** Open a file by absolute path, used by drag-drop and file association. */
  async function handleOpenPath(path: string) {
    // Guard: auto-save unsaved changes before opening
    if (fileState.isDirty && fileState.path) {
      try {
        const rev = fileState.revision;
        await saveFile(fileState.path, contentForSave());
        fileState.markSaved(rev);
      } catch (_) { /* proceed even if save fails */ }
    }
    try {
      const result = await openFile(path);
      fileState.setFile(result.path, result.filename, result.content);
      editor.loadFile(result.content);
      addToRecent(result.path);
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  let unlistenDragDrop: (() => void) | null = null;
  let unlistenMenu: (() => void) | null = null;
  let unlistenOpenFile: (() => void) | null = null;

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown);

    unlistenMenu = await listen<string>('menu-event', (event) => {
      switch (event.payload) {
        case 'new': handleNew(); break;
        case 'open': handleOpen(); break;
        case 'save': handleSave(); break;
        case 'save_as': handleSaveAs(); break;
      }
    });

    // Listen for files opened via OS file association (double-click in Finder)
    unlistenOpenFile = await listen<string>('open-file', (event) => {
      handleOpenPath(event.payload);
    });

    unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths;
        if (paths.length > 0 && paths[0].match(/\.(md|markdown|mdx)$/i)) {
          await handleOpenPath(paths[0]);
        }
      }
    });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    unlistenDragDrop?.();
    unlistenMenu?.();
    unlistenOpenFile?.();
  });
</script>

<main class="app">
  <Toolbar {getEditorView} />
  <Editor bind:this={editor} {onDocChange} {onSelectionChange} />
  <StatusBar line={cursorLine} col={cursorCol} {wordCount} isDirty={fileState.isDirty} />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
</style>
