<script lang="ts">
  import type { UpdateResult } from '$lib/updater';

  let { update, onDismiss }: {
    update: UpdateResult | null;
    onDismiss: () => void;
  } = $props();

  let installing = $state(false);
  let progress = $state('');

  async function handleInstall() {
    if (!update) return;
    installing = true;
    progress = 'Downloading...';
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          const mb = (event.data.contentLength / (1024 * 1024)).toFixed(1);
          progress = `Downloading (${mb} MB)...`;
        } else if (event.event === 'Progress') {
          progress = 'Downloading...';
        } else if (event.event === 'Finished') {
          progress = 'Installing...';
        }
      });
      // relaunch() is called explicitly in updater.ts after downloadAndInstall completes, so execution should not reach here
    } catch (e) {
      console.error('Update failed:', e);
      progress = 'Update failed. Please try again later.';
      installing = false;
    }
  }
</script>

{#if update && !installing}
  <div class="update-bar" role="status">
    <span class="update-message">Update available: v{update.info.version}</span>
    <div class="update-actions">
      <button class="update-btn primary" onclick={handleInstall}>Update Now</button>
      <button class="update-btn" onclick={onDismiss}>Later</button>
    </div>
  </div>
{:else if installing}
  <div class="update-bar installing" role="status">
    <span class="update-message">{progress}</span>
  </div>
{/if}

<style>
  .update-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    flex-shrink: 0;
  }

  .update-bar.installing {
    justify-content: center;
  }

  .update-message {
    font-weight: 500;
  }

  .update-actions {
    display: flex;
    gap: 8px;
  }

  .update-btn {
    padding: 3px 12px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    background: transparent;
    color: #ffffff;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .update-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .update-btn.primary {
    background: #ffffff;
    color: #2563eb;
    border-color: #ffffff;
    font-weight: 600;
  }

  .update-btn.primary:hover {
    background: #e0e7ff;
  }
</style>
