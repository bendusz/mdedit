import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The store uses Svelte 5 runes ($state) at module scope, which requires the
// Svelte compiler. Since vitest.config.ts already includes the Svelte plugin,
// .svelte.ts files are compiled automatically.

// We need to reset modules between tests so the $state initializer re-reads
// localStorage each time, giving us a clean slate.

const STORAGE_KEY = 'mdedit-dismissed-update';

describe('updateDismissState', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    vi.resetModules();
    // Provide a full localStorage mock since vitest jsdom may not have a standard one
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      get length() { return Object.keys(mockStorage).length; },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
    };
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadStore() {
    const mod = await import('../src/lib/stores/updateDismiss.svelte');
    return mod.updateDismissState;
  }

  it('isDismissed returns false when nothing has been dismissed', async () => {
    const store = await loadStore();
    expect(store.isDismissed('1.0.0')).toBe(false);
  });

  it('dismiss marks a version as dismissed', async () => {
    const store = await loadStore();
    store.dismiss('1.0.0');
    expect(store.isDismissed('1.0.0')).toBe(true);
  });

  it('dismissing v1.0.0 does not dismiss v1.1.0', async () => {
    const store = await loadStore();
    store.dismiss('1.0.0');
    expect(store.isDismissed('1.0.0')).toBe(true);
    expect(store.isDismissed('1.1.0')).toBe(false);
  });

  it('clearDismissal clears the stored dismissal', async () => {
    const store = await loadStore();
    store.dismiss('2.0.0');
    expect(store.isDismissed('2.0.0')).toBe(true);

    store.clearDismissal();
    expect(store.isDismissed('2.0.0')).toBe(false);
  });

  it('dismiss persists to localStorage', async () => {
    const store = await loadStore();
    store.dismiss('3.0.0');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('3.0.0');
  });

  it('clearDismissal removes the localStorage entry', async () => {
    const store = await loadStore();
    store.dismiss('3.0.0');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('3.0.0');

    store.clearDismissal();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('loads previously dismissed version from localStorage on init', async () => {
    localStorage.setItem(STORAGE_KEY, '4.0.0');
    const store = await loadStore();
    expect(store.isDismissed('4.0.0')).toBe(true);
    expect(store.isDismissed('4.1.0')).toBe(false);
  });

  it('dismissing a new version replaces the old one', async () => {
    const store = await loadStore();
    store.dismiss('1.0.0');
    expect(store.isDismissed('1.0.0')).toBe(true);

    store.dismiss('2.0.0');
    expect(store.isDismissed('1.0.0')).toBe(false);
    expect(store.isDismissed('2.0.0')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('2.0.0');
  });
});
