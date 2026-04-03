<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEditor, loadEditorContent, setImageBasePath, type CursorInfo } from '@mdedit/core';

  let { onDocChange, onSelectionChange, contentWidth }: {
    onDocChange?: (content: string) => void;
    onSelectionChange?: (info: CursorInfo) => void;
    contentWidth?: string;
  } = $props();

  let container: HTMLElement;
  let view: ReturnType<typeof createEditor>;

  onMount(() => {
    view = createEditor({
      parent: container,
      content: '# Welcome to mdedit\n\nStart typing your markdown here.',
      contentWidth,
      onDocChange,
      onSelectionChange,
    });
    view.focus();
  });

  onDestroy(() => {
    view?.destroy();
  });

  /** Replace the editor content (annotated as file load, skips onDocChange). */
  export function loadFile(content: string) {
    if (view) {
      loadEditorContent(view, content);
    }
  }

  /** Update the base directory used to resolve relative image paths. */
  export function setFileBasePath(basePath: string) {
    if (view) {
      setImageBasePath(view, basePath);
    }
  }

  /** Get the underlying EditorView instance. */
  export function getView(): ReturnType<typeof createEditor> | undefined {
    return view;
  }
</script>

<div class="editor-container" bind:this={container}></div>

<style>
  .editor-container {
    flex: 1;
    overflow: auto;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }

  .editor-container :global(.cm-scroller) {
    overflow: auto;
  }

  .editor-container :global(.cm-content) {
    padding: 16px 24px;
    margin: 0 auto;
  }
</style>
