<script lang="ts">
  import { widthPresets } from '$lib/stores/contentWidth.svelte';

  let { line, col, wordCount, isDirty, contentWidth, onContentWidthChange }: {
    line: number;
    col: number;
    wordCount: number;
    isDirty: boolean;
    contentWidth: string;
    onContentWidthChange: (width: string) => void;
  } = $props();

  function handleWidthChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    onContentWidthChange(select.value);
  }
</script>

<div class="status-bar">
  <div class="status-left">
    <span>Ln {line}, Col {col}</span>
    <span class="sep">|</span>
    <span>{wordCount} words</span>
  </div>
  <div class="status-right">
    <select class="width-select" value={contentWidth} onchange={handleWidthChange}>
      {#each widthPresets as preset}
        <option value={preset.value}>{preset.label}</option>
      {/each}
    </select>
    <span class="sep">|</span>
    <span>UTF-8</span>
    <span class="sep">|</span>
    <span class:unsaved={isDirty}>{isDirty ? 'Unsaved' : 'Saved'}</span>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    padding: 0 12px;
    font-size: 12px;
    color: var(--statusbar-fg);
    background: var(--statusbar-bg);
    border-top: 1px solid var(--statusbar-border);
    flex-shrink: 0;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sep {
    color: var(--statusbar-sep);
  }

  .unsaved {
    color: var(--unsaved-fg);
  }

  .width-select {
    background: transparent;
    border: none;
    color: inherit;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    padding: 0 2px;
    outline: none;
  }
</style>
