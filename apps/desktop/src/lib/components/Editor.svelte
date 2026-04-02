<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEditor } from '@mdedit/core';

  let container: HTMLElement;
  let view: ReturnType<typeof createEditor>;

  onMount(() => {
    view = createEditor({
      parent: container,
      content: '# Welcome to mdedit\n\nStart typing your markdown here.',
    });
    view.focus();
  });

  onDestroy(() => {
    view?.destroy();
  });
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
