<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import UpdateNotification from '$lib/components/UpdateNotification.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { showToast } from '$lib/stores/toast.svelte';
  import { fileState } from '$lib/stores/fileState.svelte';
  import { themeState } from '$lib/stores/theme.svelte';
  import { updateDismissState } from '$lib/stores/updateDismiss.svelte';
  import { startUpdateChecker, stopUpdateChecker, checkForUpdates, type UpdateResult } from '$lib/updater';
  import {
    acceptPendingFile,
    addToRecent,
    clearCurrentFile,
    exportHtmlDialog,
    getStartupFile,
    openFileDialog,
    saveCurrentFile,
    saveFileAsDialog,
    savePastedImage,
    type FileData,
  } from '$lib/tauri/fileOps';
  import { logError, getLogPath } from '$lib/logger';
  import { printHtml } from '$lib/print';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { openPath } from '@tauri-apps/plugin-opener';
  import { exit } from '@tauri-apps/plugin-process';
  import { listen } from '@tauri-apps/api/event';
  import { setEditorTheme, setContentWidth, setReadOnly, setFocusHighlight, setTypewriterScrolling, registerPaletteCommands, getOutline, markdownToHtml, EditorView, themeList, type CursorInfo, type PaletteCommand, type OutlineEntry, type ThemeId } from '@mdedit/core';
  import OutlineSidebar from '$lib/components/OutlineSidebar.svelte';
  import { contentWidthState } from '$lib/stores/contentWidth.svelte';

  let editor: Editor;
  let cursorLine = $state(1);
  let cursorCol = $state(1);
  let wordCount = $state(0);
  let showOutline = $state(false);
  let readingMode = $state(false);
  let zenMode = $state(false);
  let typewriterMode = $state(false);
  let preZenWidth: string | null = null;
  let preZenTypewriter: boolean = false;
  let outlineEntries: OutlineEntry[] = $state([]);
  let pendingUpdate: UpdateResult | null = $state(null);

  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const WELCOME_CONTENT = '# Welcome to mdedit\n\nStart typing your markdown here.';

  function directoryOf(filePath: string | null): string {
    if (!filePath) {
      return '';
    }
    return filePath.replace(/[\\/][^\\/]*$/, '');
  }

  function exitReadingMode() {
    if (readingMode) {
      readingMode = false;
      const view = getEditorView();
      if (view) setReadOnly(view, false);
    }
  }

  function toggleTypewriterMode() {
    const view = getEditorView();
    if (!view) return;
    typewriterMode = !typewriterMode;
    setTypewriterScrolling(view, typewriterMode);
  }

  async function toggleZenMode() {
    const view = getEditorView();
    if (!view) return;

    const appWindow = getCurrentWindow();
    const entering = !zenMode;
    try {
      if (entering) {
        exitReadingMode();
        await appWindow.setFullscreen(true);
        zenMode = true;
        preZenWidth = contentWidthState.width;
        preZenTypewriter = typewriterMode;
        setContentWidth(view, '72ch');
        setFocusHighlight(view, true);
        if (!typewriterMode) {
          typewriterMode = true;
          setTypewriterScrolling(view, true);
        }
      } else {
        await appWindow.setFullscreen(false);
        zenMode = false;
        if (preZenWidth) setContentWidth(view, preZenWidth);
        setFocusHighlight(view, false);
        if (!preZenTypewriter) {
          typewriterMode = false;
          setTypewriterScrolling(view, false);
        }
      }
    } catch (e) {
      void logError('general', 'Failed to toggle zen mode', String(e));
    }

    // Re-focus the editor after toggling
    view.focus();
  }

  async function exitZenMode() {
    if (zenMode) {
      await toggleZenMode();
    }
  }

  function applyLoadedFile(data: FileData) {
    exitReadingMode();
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
          void logError('auto-save', 'Auto-save failed', String(e));
          showToast('Auto-save failed.', 'error');
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

  async function toggleReadingMode() {
    const view = getEditorView();
    if (!view) return;

    if (!readingMode && !(await saveCurrentDocumentBeforeSwitch())) {
      return;
    }

    readingMode = !readingMode;
    setReadOnly(view, readingMode);
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
        void logError('file-io', 'Failed to save file before switching', String(e));
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
      void logError('file-io', 'Failed to save file before switching', String(e));
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
          void logError('file-io', 'Failed to update recent files', String(recentError));
        }
      }
    } catch (e) {
      void logError('file-io', 'Failed to open file', String(e));
      showToast('Failed to open file.', 'error');
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
      void logError('file-io', 'Failed to save file', String(e));
      showToast('Failed to save file.', 'error');
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
      void logError('file-io', 'Failed to save file', String(e));
      showToast('Failed to save file.', 'error');
    }
  }

  async function handleExportHtml() {
    try {
      const html = markdownToHtml(fileState.content);
      await exportHtmlDialog(html);
    } catch (e) {
      void logError('export', 'Failed to export HTML', String(e));
      showToast('Failed to export HTML.', 'error');
    }
  }

  function handlePrint() {
    try {
      const html = markdownToHtml(fileState.content);
      printHtml(html);
    } catch (e) {
      void logError('export', 'Failed to print', String(e));
      showToast('Failed to print.', 'error');
    }
  }

  function handleExportPdf() {
    // On macOS, the native print dialog provides "Save as PDF" in the PDF dropdown.
    // Reuse the same print flow — the user selects "Save as PDF" from the dialog.
    handlePrint();
  }

  /**
   * Quit the application, saving any dirty document first.
   * Uses the same save logic as the close handler: auto-saves if a path exists,
   * or prompts Save As for untitled documents. If the user cancels Save As,
   * the quit is aborted.
   */
  async function handleQuit() {
    if (fileState.isDirty) {
      if (fileState.path) {
        // File has a path — try to auto-save before quitting
        try {
          const rev = fileState.revision;
          await saveCurrentFile(contentForSave());
          fileState.markSaved(rev);
        } catch (e) {
          void logError('file-io', 'Failed to save on quit', String(e));
          showToast('Failed to save before quitting. Your changes are preserved.', 'error', 6000);
          return; // Abort quit so user doesn't lose work
        }
      } else {
        // Untitled dirty document — offer Save As dialog
        try {
          const result = await saveFileAsDialog(contentForSave());
          if (!result) {
            return; // User cancelled — abort quit
          }
          fileState.setFile(result.path, result.filename, fileState.content);
        } catch (e) {
          void logError('file-io', 'Failed to save on quit', String(e));
          showToast('Failed to save before quitting. Your changes are preserved.', 'error', 6000);
          return; // Abort quit
        }
      }
    }
    await exit(0);
  }

  async function handleNew() {
    if (!(await saveCurrentDocumentBeforeSwitch())) {
      return;
    }

    exitReadingMode();
    fileState.reset();
    editor.setFileBasePath('');
    editor.loadFile(WELCOME_CONTENT);
    updateOutline();
    try {
      await clearCurrentFile();
    } catch (e) {
      void logError('file-io', 'Failed to clear current file', String(e));
    }
  }

  /**
   * Extract the MIME subtype from a MIME type string (e.g., "image/png" -> "png").
   */
  function mimeSubtype(mimeType: string): string {
    const parts = mimeType.split('/');
    return parts[1] ?? 'png';
  }

  /**
   * Convert a Blob to a base64-encoded string (without the data URI prefix).
   */
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the "data:image/png;base64," prefix
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read image data'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Handle paste events — if the clipboard contains an image, save it to disk
   * alongside the current file and insert a markdown image reference.
   */
  async function handlePaste(e: ClipboardEvent) {
    if (readingMode) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    // Find the first image item in the clipboard
    let imageItem: DataTransferItem | null = null;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        imageItem = item;
        break;
      }
    }
    if (!imageItem) return;

    // We have an image — prevent the default paste behavior
    e.preventDefault();

    const file = imageItem.getAsFile();
    if (!file) return;

    // If no file is open, prompt Save As first so we have a directory
    let dir = directoryOf(fileState.path);
    if (!dir) {
      const rev = fileState.revision;
      try {
        const result = await saveFileAsDialog(contentForSave());
        if (!result) return; // User cancelled
        fileState.setFile(result.path, result.filename, result.content);
        editor.setFileBasePath(directoryOf(result.path));
        fileState.markSaved(rev);
        dir = directoryOf(result.path);
      } catch (err) {
        void logError('paste', 'Failed to save file before pasting image', String(err));
        return;
      }
    }

    if (!dir) return;

    try {
      const base64Data = await blobToBase64(file);
      const subtype = mimeSubtype(imageItem.type);
      const savedFilename = await savePastedImage(base64Data, dir, undefined, subtype);

      // Insert markdown image reference at the cursor position
      const view = getEditorView();
      if (view) {
        const { from } = view.state.selection.main;
        const insert = `![](${savedFilename})`;
        view.dispatch({
          changes: { from, insert },
          selection: { anchor: from + insert.length },
        });
      }
    } catch (err) {
      void logError('paste', 'Failed to paste image', String(err));
      showToast('Failed to paste image.', 'error');
    }
  }

  /**
   * Programmatically read an image from the clipboard (for command palette).
   * Uses the Clipboard API's read() method.
   */
  async function pasteImageFromClipboard() {
    if (readingMode) return;
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          // Synthesize the same flow as handlePaste
          let dir = directoryOf(fileState.path);
          if (!dir) {
            const rev = fileState.revision;
            const result = await saveFileAsDialog(contentForSave());
            if (!result) return;
            fileState.setFile(result.path, result.filename, result.content);
            editor.setFileBasePath(directoryOf(result.path));
            fileState.markSaved(rev);
            dir = directoryOf(result.path);
          }
          if (!dir) return;

          const base64Data = await blobToBase64(blob);
          const subtype = mimeSubtype(imageType);
          const savedFilename = await savePastedImage(base64Data, dir, undefined, subtype);

          const view = getEditorView();
          if (view) {
            const { from } = view.state.selection.main;
            const insert = `![](${savedFilename})`;
            view.dispatch({
              changes: { from, insert },
              selection: { anchor: from + insert.length },
            });
          }
          return;
        }
      }
    } catch (err) {
      void logError('paste', 'Failed to read clipboard', String(err));
      showToast('Failed to paste image.', 'error');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (key === 'escape' && zenMode) {
      e.preventDefault();
      void exitZenMode();
      return;
    } else if (mod && e.shiftKey && key === 'f') {
      e.preventDefault();
      void toggleZenMode();
      return;
    } else if (mod && e.shiftKey && key === 'r') {
      e.preventDefault();
      void toggleReadingMode();
    } else if (mod && e.shiftKey && key === 'e') {
      e.preventDefault();
      void handleExportHtml();
    } else if (mod && e.shiftKey && key === 'o') {
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
    } else if (mod && key === 'p') {
      e.preventDefault();
      handlePrint();
    } else if (mod && key === 'n') {
      e.preventDefault();
      void handleNew();
    } else if (mod && key === 'q') {
      e.preventDefault();
      void handleQuit();
    }
  }

  $effect(() => {
    const dot = fileState.isDirty ? '\u25CF ' : '';
    const name = fileState.filename ?? 'Untitled';
    getCurrentWindow().setTitle(`${dot}${name} \u2014 mdedit`);
  });

  $effect(() => {
    const id = themeState.themeId;
    // Only add .dark class for the default dark theme, not named dark themes.
    // Named dark themes (solarized-dark, nord) use data-theme attribute selectors in CSS.
    document.documentElement.classList.toggle('dark', id === 'dark');
    document.documentElement.setAttribute('data-theme', id);
    const view = getEditorView();
    if (view) {
      setEditorTheme(view, id);
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
        void logError('file-io', 'Failed to update recent files', String(recentError));
      }
    } catch (e) {
      void logError('file-io', 'Failed to open file', String(e));
      showToast('Failed to open file.', 'error');
    }
  }

  let unlistenMenu: (() => void) | null = null;
  let unlistenOpenFile: (() => void) | null = null;
  let unlistenClose: (() => void) | null = null;

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('paste', handlePaste);

    // Register app-level commands in the command palette
    const view = getEditorView();
    if (view) {
      const appCommands: PaletteCommand[] = [
        { id: 'file-new', label: 'New File', category: 'File', shortcut: '\u2318N', execute: () => { void handleNew(); } },
        { id: 'file-open', label: 'Open File', category: 'File', shortcut: '\u2318O', execute: () => { void handleOpen(); } },
        { id: 'file-save', label: 'Save', category: 'File', shortcut: '\u2318S', execute: () => { void handleSave(); } },
        { id: 'file-save-as', label: 'Save As...', category: 'File', shortcut: '\u2318\u21E7S', execute: () => { void handleSaveAs(); } },
        { id: 'file-export-html', label: 'Export to HTML', category: 'File', shortcut: '\u2318\u21E7E', execute: () => { void handleExportHtml(); } },
        { id: 'file-print', label: 'Print', category: 'File', shortcut: '\u2318P', execute: () => { handlePrint(); } },
        { id: 'file-export-pdf', label: 'Export to PDF', category: 'File', execute: () => { handleExportPdf(); } },
        { id: 'view-toggle-outline', label: 'Toggle Outline', category: 'View', shortcut: '\u2318\u21E7O', execute: () => { toggleOutline(); } },
        { id: 'view-toggle-reading-mode', label: 'Toggle Reading Mode', category: 'View', shortcut: '\u2318\u21E7R', execute: () => { void toggleReadingMode(); } },
        { id: 'view-toggle-zen-mode', label: 'Toggle Zen Mode', category: 'View', shortcut: '\u2318\u21E7F', execute: () => { void toggleZenMode(); } },
        { id: 'view-toggle-typewriter', label: 'Toggle Typewriter Scrolling', category: 'View', execute: () => { toggleTypewriterMode(); } },
        { id: 'edit-paste-image', label: 'Paste Image', category: 'Edit', execute: () => { void pasteImageFromClipboard(); } },
        { id: 'app-check-updates', label: 'Check for Updates', category: 'App', execute: () => { void checkForUpdates().then((r) => { if (r.status === 'update-available') { updateDismissState.clearDismissal(); pendingUpdate = r.result; } else if (r.status === 'up-to-date') { showToast('You\'re up to date!', 'success'); } else { showToast('Update check failed. Please try again later.', 'error'); } }); } },
        { id: 'app-view-error-log', label: 'View Error Log', category: 'App', execute: () => { void getLogPath().then((p) => openPath(p)).catch((err) => { void logError('general', 'Failed to open error log', String(err)); showToast('Failed to open error log.', 'error'); }); } },
        ...themeList.map((t) => ({
          id: `theme-${t.id}`,
          label: `Theme: ${t.label}`,
          category: 'View' as const,
          execute: () => { themeState.setTheme(t.id); },
        })),
      ];
      registerPaletteCommands(view, appCommands);
      updateOutline();
    }

    // Start periodic update checks (respect dismissal for background checks)
    startUpdateChecker((result) => {
      if (!updateDismissState.isDismissed(result.info.version)) {
        pendingUpdate = result;
      }
    });

    unlistenMenu = await listen<string>('menu-event', (event) => {
      switch (event.payload) {
        case 'new': void handleNew(); break;
        case 'open': void handleOpen(); break;
        case 'save': void handleSave(); break;
        case 'save_as': void handleSaveAs(); break;
        case 'export_html': void handleExportHtml(); break;
        case 'print': handlePrint(); break;
        case 'export_pdf': handleExportPdf(); break;
        case 'quit': void handleQuit(); break;
      }
    });

    // Listen for files opened via OS file association or drag-drop.
    unlistenOpenFile = await listen<FileData>('open-file', (event) => {
      void handleOpenExternalFile(event.payload);
    });

    // Check for a file opened during cold start (before the webview was ready).
    // get_startup_file already accepted the pending path atomically in Rust,
    // so we apply the file directly without calling acceptPendingFile.
    try {
      const startupFile = await getStartupFile();
      if (startupFile) {
        applyLoadedFile(startupFile);
        try {
          await addToRecent(startupFile.path);
        } catch (recentError) {
          void logError('file-io', 'Failed to update recent files', String(recentError));
        }
      }
    } catch (e) {
      void logError('file-io', 'Failed to open startup file', String(e));
      showToast('Failed to open startup file.', 'error');
    }

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
            void logError('file-io', 'Failed to save on close', String(e));
            showToast('Failed to save before closing. Your changes are preserved.', 'error', 6000);
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
            void logError('file-io', 'Failed to save on close', String(e));
            showToast('Failed to save before closing. Your changes are preserved.', 'error', 6000);
          }
        }
      }
    });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('paste', handlePaste);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    stopUpdateChecker();
    unlistenMenu?.();
    unlistenOpenFile?.();
    unlistenClose?.();
  });
</script>

<Toast />

<main class="app" class:zen-mode={zenMode}>
  <UpdateNotification update={pendingUpdate} onDismiss={() => { pendingUpdate = null; }} />
  {#if !readingMode && !zenMode}
    <Toolbar {getEditorView} />
  {/if}
  <div class="editor-area">
    <Editor bind:this={editor} {onDocChange} {onSelectionChange} />
    {#if !zenMode}
      <OutlineSidebar entries={outlineEntries} visible={showOutline} onEntryClick={handleOutlineEntryClick} />
    {/if}
  </div>
  {#if !zenMode}
    <StatusBar line={cursorLine} col={cursorCol} {wordCount} isDirty={fileState.isDirty} {readingMode} contentWidth={contentWidthState.width} onContentWidthChange={(w) => contentWidthState.setWidth(w)} currentTheme={themeState.themeId} onThemeChange={(id: ThemeId) => themeState.setTheme(id)} />
  {/if}
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

  .zen-mode {
    background: var(--bg);
  }

  .zen-mode .editor-area :global(.cm-content) {
    padding-top: 20vh;
    padding-bottom: 40vh;
  }
</style>
