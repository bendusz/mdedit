<script lang="ts">
  import { toastState, dismissToast, type ToastType } from '$lib/stores/toast.svelte';

  function icon(type: ToastType): string {
    switch (type) {
      case 'success': return '\u2713';
      case 'error': return '\u2717';
      case 'warning': return '\u26A0';
      case 'info': return '\u2139';
    }
  }
</script>

{#if toastState.toasts.length > 0}
  <div class="toast-container" role="log" aria-live="polite">
    {#each toastState.toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}" role="status">
        <span class="toast-icon">{icon(toast.type)}</span>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" onclick={() => dismissToast(toast.id)} aria-label="Dismiss">&times;</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 36px;
    right: 16px;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    pointer-events: none;
    max-width: 380px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    line-height: 1.4;
    box-shadow: 0 4px 12px var(--shadow, rgba(0, 0, 0, 0.12));
    pointer-events: auto;
    animation: toast-slide-in 0.25s ease-out;
  }

  @keyframes toast-slide-in {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .toast-icon {
    flex-shrink: 0;
    font-size: 15px;
    line-height: 1;
  }

  .toast-message {
    flex: 1;
    min-width: 0;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0.6;
    color: inherit;
    font-family: inherit;
  }

  .toast-close:hover {
    opacity: 1;
  }

  /* --- Type colors --- */
  .toast-success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .toast-error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .toast-warning {
    background: #fffbeb;
    color: #92400e;
    border: 1px solid #fde68a;
  }

  .toast-info {
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  /* Dark theme overrides */
  :global(:root.dark) .toast-success,
  :global(:root[data-theme="solarized-dark"]) .toast-success,
  :global(:root[data-theme="nord"]) .toast-success {
    background: #14532d;
    color: #bbf7d0;
    border-color: #166534;
  }

  :global(:root.dark) .toast-error,
  :global(:root[data-theme="solarized-dark"]) .toast-error,
  :global(:root[data-theme="nord"]) .toast-error {
    background: #7f1d1d;
    color: #fecaca;
    border-color: #991b1b;
  }

  :global(:root.dark) .toast-warning,
  :global(:root[data-theme="solarized-dark"]) .toast-warning,
  :global(:root[data-theme="nord"]) .toast-warning {
    background: #78350f;
    color: #fde68a;
    border-color: #92400e;
  }

  :global(:root.dark) .toast-info,
  :global(:root[data-theme="solarized-dark"]) .toast-info,
  :global(:root[data-theme="nord"]) .toast-info {
    background: #1e3a5f;
    color: #bfdbfe;
    border-color: #1e40af;
  }
</style>
