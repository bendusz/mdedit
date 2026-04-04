import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToast, dismissToast, toastState } from '../src/lib/stores/toast.svelte';

// ---- Helpers ----

/** Dismiss all currently active toasts to reset state between tests. */
function clearAllToasts() {
  const ids = toastState.toasts.map((t) => t.id);
  for (const id of ids) {
    dismissToast(id);
  }
}

// ---- Tests ----

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllToasts();
  });

  afterEach(() => {
    clearAllToasts();
    vi.useRealTimers();
  });

  it('showToast adds a toast to state', () => {
    showToast('Hello world', 'info');

    expect(toastState.toasts).toHaveLength(1);
    expect(toastState.toasts[0].message).toBe('Hello world');
    expect(toastState.toasts[0].type).toBe('info');
    expect(toastState.toasts[0].duration).toBe(4000);
  });

  it('auto-dismiss fires after duration and removes toast', () => {
    showToast('Auto bye', 'success', 3000);

    expect(toastState.toasts).toHaveLength(1);

    // Before the timer fires, toast is still present
    vi.advanceTimersByTime(2999);
    expect(toastState.toasts).toHaveLength(1);

    // After duration, toast is removed
    vi.advanceTimersByTime(1);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('dismissToast before timer clears the timer', () => {
    const id = showToast('Dismiss me', 'warning', 5000);

    expect(toastState.toasts).toHaveLength(1);

    dismissToast(id);

    expect(toastState.toasts).toHaveLength(0);

    // Advance past original duration — no errors, no re-appearance
    vi.advanceTimersByTime(5000);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('multiple toasts stack independently', () => {
    showToast('First', 'info', 1000);
    showToast('Second', 'error', 2000);
    showToast('Third', 'success', 3000);

    expect(toastState.toasts).toHaveLength(3);

    // After 1s, only the first toast should be gone
    vi.advanceTimersByTime(1000);
    expect(toastState.toasts).toHaveLength(2);
    expect(toastState.toasts.map((t) => t.message)).toEqual(['Second', 'Third']);

    // After 2s total, second toast gone
    vi.advanceTimersByTime(1000);
    expect(toastState.toasts).toHaveLength(1);
    expect(toastState.toasts[0].message).toBe('Third');

    // After 3s total, all gone
    vi.advanceTimersByTime(1000);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('dismissToast on non-existent id is a no-op', () => {
    showToast('Existing', 'info', 4000);
    expect(toastState.toasts).toHaveLength(1);

    // Dismissing a non-existent id should not throw or affect existing toasts
    expect(() => dismissToast('toast-999-9999999')).not.toThrow();
    expect(toastState.toasts).toHaveLength(1);
  });

  it('custom duration is respected', () => {
    showToast('Short lived', 'error', 500);

    expect(toastState.toasts).toHaveLength(1);

    vi.advanceTimersByTime(499);
    expect(toastState.toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(toastState.toasts).toHaveLength(0);
  });

  it('showToast returns the id of the new toast', () => {
    const id = showToast('With id', 'info');

    expect(id).toBeTruthy();
    expect(toastState.toasts[0].id).toBe(id);
  });

  it('each toast gets a unique id', () => {
    const id1 = showToast('First', 'info');
    const id2 = showToast('Second', 'info');
    const id3 = showToast('Third', 'info');

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});
