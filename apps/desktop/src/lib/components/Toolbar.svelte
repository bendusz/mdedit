<script lang="ts">
  import {
    type EditorView,
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    insertLink,
    insertImage,
    setHeading,
    toggleList,
    toggleTaskList,
    insertCodeBlock,
    insertHorizontalRule,
    insertTable,
  } from '@mdedit/core';

  let { getEditorView }: { getEditorView: () => EditorView | undefined } = $props();

  let headingMenuOpen = $state(false);

  function run(fn: (view: EditorView, ...args: any[]) => void, ...args: any[]) {
    const view = getEditorView();
    if (view) {
      fn(view, ...args);
      view.focus();
    }
  }

  function handleHeading(level: number) {
    run(setHeading, level);
    headingMenuOpen = false;
  }

  function toggleHeadingMenu() {
    headingMenuOpen = !headingMenuOpen;
  }

  function closeHeadingMenu() {
    headingMenuOpen = false;
  }
</script>

<div class="toolbar" role="toolbar" aria-label="Formatting toolbar">
  <button
    class="toolbar-btn bold"
    onclick={() => run(toggleBold)}
    title="Bold (Cmd+B)"
    aria-label="Bold (Cmd+B)"
  >B</button>

  <button
    class="toolbar-btn italic"
    onclick={() => run(toggleItalic)}
    title="Italic (Cmd+I)"
    aria-label="Italic (Cmd+I)"
  >I</button>

  <button
    class="toolbar-btn strikethrough"
    onclick={() => run(toggleStrikethrough)}
    title="Strikethrough (Cmd+Shift+X)"
    aria-label="Strikethrough (Cmd+Shift+X)"
  >S</button>

  <div class="toolbar-separator"></div>

  <div class="heading-dropdown">
    <button
      class="toolbar-btn"
      onclick={toggleHeadingMenu}
      title="Heading"
      aria-label="Heading"
      aria-expanded={headingMenuOpen}
      aria-haspopup="true"
    >H</button>

    {#if headingMenuOpen}
      <div class="heading-menu" role="menu" tabindex="-1" onmouseleave={closeHeadingMenu}>
        {#each [1, 2, 3, 4, 5, 6] as level}
          <button
            class="heading-option"
            role="menuitem"
            onclick={() => handleHeading(level)}
          >H{level}</button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="toolbar-separator"></div>

  <button
    class="toolbar-btn"
    onclick={() => run(insertLink)}
    title="Link (Cmd+K)"
    aria-label="Insert link (Cmd+K)"
  >Link</button>

  <button
    class="toolbar-btn"
    onclick={() => run(insertImage)}
    title="Image"
    aria-label="Insert image"
  >Img</button>

  <button
    class="toolbar-btn"
    onclick={() => run(insertCodeBlock)}
    title="Code block (Cmd+Shift+C)"
    aria-label="Code block (Cmd+Shift+C)"
  >Code</button>

  <div class="toolbar-separator"></div>

  <button
    class="toolbar-btn"
    onclick={() => run(toggleList)}
    title="Bullet list"
    aria-label="Bullet list"
  >List</button>

  <button
    class="toolbar-btn"
    onclick={() => run(toggleTaskList)}
    title="Task list"
    aria-label="Task list"
  >Task</button>

  <button
    class="toolbar-btn"
    onclick={() => run(insertTable)}
    title="Table"
    aria-label="Insert table"
  >Table</button>

  <button
    class="toolbar-btn"
    onclick={() => run(insertHorizontalRule)}
    title="Horizontal rule"
    aria-label="Insert horizontal rule"
  >HR</button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--toolbar-border, #e5e7eb);
    background: var(--toolbar-bg, #f9fafb);
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 2px 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--fg, #1a1a1a);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    line-height: 1;
  }

  .toolbar-btn:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .toolbar-btn:active {
    background: rgba(0, 0, 0, 0.12);
  }

  .toolbar-btn.bold {
    font-weight: 700;
  }

  .toolbar-btn.italic {
    font-style: italic;
  }

  .toolbar-btn.strikethrough {
    text-decoration: line-through;
  }

  .toolbar-separator {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--toolbar-border, #e5e7eb);
  }

  .heading-dropdown {
    position: relative;
  }

  .heading-menu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    padding: 4px;
    margin-top: 2px;
    background: var(--toolbar-bg, #f9fafb);
    border: 1px solid var(--toolbar-border, #e5e7eb);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  .heading-option {
    display: block;
    width: 100%;
    padding: 4px 12px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--fg, #1a1a1a);
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }

  .heading-option:hover {
    background: rgba(0, 0, 0, 0.08);
  }
</style>
