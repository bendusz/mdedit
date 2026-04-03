<script lang="ts">
  import { widthPresets } from '$lib/stores/contentWidth.svelte';
  import { themeList, type ThemeId } from '@mdedit/core';

  let { line, col, wordCount, isDirty, readingMode, contentWidth, onContentWidthChange, currentTheme, onThemeChange }: {
    line: number;
    col: number;
    wordCount: number;
    isDirty: boolean;
    readingMode: boolean;
    contentWidth: string;
    onContentWidthChange: (width: string) => void;
    currentTheme: ThemeId;
    onThemeChange: (id: ThemeId) => void;
  } = $props();

  function handleWidthChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    onContentWidthChange(select.value);
  }

  function handleThemeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    onThemeChange(select.value as ThemeId);
  }
</script>

<div class="status-bar">
  <div class="status-left">
    <span>Ln {line}, Col {col}</span>
    <span class="sep">|</span>
    <span>{wordCount} words</span>
  </div>
  <div class="status-right">
    {#if readingMode}
      <span class="reading-badge">Reading</span>
      <span class="sep">|</span>
    {/if}
    <select class="width-select" value={contentWidth} onchange={handleWidthChange}>
      {#each widthPresets as preset}
        <option value={preset.value}>{preset.label}</option>
      {/each}
    </select>
    <span class="sep">|</span>
    <select class="theme-select" value={currentTheme} onchange={handleThemeChange}>
      {#each themeList as theme}
        <option value={theme.id}>{theme.label}</option>
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

  .reading-badge {
    color: var(--reading-badge-fg, #6366f1);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .width-select,
  .theme-select {
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
