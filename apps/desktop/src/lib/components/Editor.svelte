<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEditor, loadEditorContent } from '@mdedit/core';

  let { onDocChange }: { onDocChange?: (content: string) => void } = $props();

  let container: HTMLElement;
  let view: ReturnType<typeof createEditor>;

  onMount(() => {
    view = createEditor({
      parent: container,
      content: '# Welcome to mdedit\n\nStart typing your markdown here.',
      onDocChange,
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
</style>
