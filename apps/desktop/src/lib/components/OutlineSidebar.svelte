<script lang="ts">
  import type { OutlineEntry } from '@mdedit/core';

  let { entries, visible, onEntryClick }: {
    entries: OutlineEntry[];
    visible: boolean;
    onEntryClick: (entry: OutlineEntry) => void;
  } = $props();
</script>

{#if visible}
  <aside class="outline-sidebar">
    <div class="outline-header">Outline</div>
    {#if entries.length === 0}
      <div class="outline-empty">No headings</div>
    {:else}
      <nav class="outline-list">
        {#each entries as entry}
          <button
            class="outline-entry outline-level-{entry.level}"
            onclick={() => onEntryClick(entry)}
            title={entry.text}
          >
            {entry.text || '(empty)'}
          </button>
        {/each}
      </nav>
    {/if}
  </aside>
{/if}

<style>
  .outline-sidebar {
    width: 220px;
    min-width: 220px;
    height: 100%;
    overflow-y: auto;
    border-left: 1px solid var(--toolbar-border, #e5e7eb);
    background: var(--toolbar-bg, #f9fafb);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .outline-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--statusbar-fg, #888888);
    border-bottom: 1px solid var(--toolbar-border, #e5e7eb);
    flex-shrink: 0;
  }

  .outline-empty {
    padding: 12px;
    font-size: 13px;
    color: var(--statusbar-fg, #888888);
    font-style: italic;
  }

  .outline-list {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    overflow-y: auto;
  }

  .outline-entry {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 4px 12px;
    font-size: 13px;
    line-height: 1.4;
    color: var(--fg, #1a1a1a);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: inherit;
  }

  .outline-entry:hover {
    background: var(--hover-bg, rgba(0, 0, 0, 0.08));
  }

  .outline-entry:active {
    background: var(--active-bg, rgba(0, 0, 0, 0.12));
  }

  .outline-level-1 { padding-left: 12px; font-weight: 600; }
  .outline-level-2 { padding-left: 24px; }
  .outline-level-3 { padding-left: 36px; }
  .outline-level-4 { padding-left: 48px; }
  .outline-level-5 { padding-left: 60px; }
  .outline-level-6 { padding-left: 72px; }
</style>
