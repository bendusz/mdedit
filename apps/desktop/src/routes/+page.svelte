<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Editor from '$lib/components/Editor.svelte';
  import { fileState } from '$lib/stores/fileState.svelte';
  import { openFileDialog, saveFile, saveFileAsDialog } from '$lib/tauri/fileOps';

  let editor: Editor;

  function onDocChange(content: string) {
    fileState.setContent(content);
  }

  async function handleOpen() {
    try {
      const result = await openFileDialog();
      if (result) {
        fileState.setFile(result.path, result.filename, result.content);
        editor.loadFile(result.content);
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  async function handleSave() {
    if (!fileState.path) {
      return handleSaveAs();
    }
    const rev = fileState.revision;
    try {
      await saveFile(fileState.path, fileState.content);
      fileState.markSaved(rev);
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  }

  async function handleSaveAs() {
    const rev = fileState.revision;
    try {
      const result = await saveFileAsDialog(fileState.content);
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
    if (mod && e.key === 'o') {
      e.preventDefault();
      handleOpen();
    } else if (mod && e.shiftKey && e.key === 's') {
      e.preventDefault();
      handleSaveAs();
    } else if (mod && e.key === 's') {
      e.preventDefault();
      handleSave();
    } else if (mod && e.key === 'n') {
      e.preventDefault();
      handleNew();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<main class="app">
  <Editor bind:this={editor} {onDocChange} />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
</style>
