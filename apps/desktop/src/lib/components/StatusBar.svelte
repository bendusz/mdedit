<script lang="ts">
  let { line, col, wordCount, isDirty }: {
    line: number;
    col: number;
    wordCount: number;
    isDirty: boolean;
  } = $props();
</script>

<div class="status-bar">
  <div class="status-left">
    <span>Ln {line}, Col {col}</span>
    <span class="sep">|</span>
    <span>{wordCount} words</span>
  </div>
  <div class="status-right">
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
    color: #888;
    background: #f5f5f5;
    border-top: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sep {
    color: #ccc;
  }

  .unsaved {
    color: #c47a10;
  }
</style>
