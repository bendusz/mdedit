import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Tauri plugin mocks ----

const { mockCheck, mockRelaunch } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockRelaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mockCheck,
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: mockRelaunch,
}));

import {
  checkForUpdates,
  startUpdateChecker,
  stopUpdateChecker,
} from '../src/lib/updater';
import type { UpdateResult, CheckResult } from '../src/lib/updater';

// ---- Helpers ----

function makeTauriUpdate(overrides: {
  version?: string;
  body?: string | null;
  date?: string | null;
  downloadAndInstall?: (...args: unknown[]) => Promise<void>;
  close?: () => Promise<void>;
} = {}) {
  return {
    version: overrides.version ?? '2.0.0',
    body: 'body' in overrides ? overrides.body : 'Release notes here',
    date: 'date' in overrides ? overrides.date : '2026-04-01',
    downloadAndInstall: overrides.downloadAndInstall ?? vi.fn().mockResolvedValue(undefined),
    close: overrides.close ?? vi.fn().mockResolvedValue(undefined),
  };
}

/** Flush the microtask queue so async callbacks settle under fake timers. */
async function flushMicrotasks(): Promise<void> {
  // vi.advanceTimersByTimeAsync(0) drains microtasks without advancing time,
  // unlike vi.runAllTimersAsync which also runs newly-scheduled timers (infinite loop with setInterval).
  await vi.advanceTimersByTimeAsync(0);
}

// ---- Tests ----

describe('checkForUpdates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRelaunch.mockResolvedValue(undefined);
  });

  it('returns up-to-date when check() returns null', async () => {
    mockCheck.mockResolvedValue(null);

    const result = await checkForUpdates();

    expect(result).toEqual({ status: 'up-to-date' });
  });

  it('returns up-to-date when check() returns undefined', async () => {
    mockCheck.mockResolvedValue(undefined);

    const result = await checkForUpdates();

    expect(result).toEqual({ status: 'up-to-date' });
  });

  it('returns update-available with correct info when an update exists', async () => {
    mockCheck.mockResolvedValue(makeTauriUpdate({
      version: '3.1.0',
      body: 'New features',
      date: '2026-04-02',
    }));

    const result = await checkForUpdates();

    expect(result.status).toBe('update-available');
    if (result.status !== 'update-available') throw new Error('unreachable');
    expect(result.result.info).toEqual({
      version: '3.1.0',
      body: 'New features',
      date: '2026-04-02',
    });
  });

  it('converts null body/date to undefined in UpdateInfo', async () => {
    mockCheck.mockResolvedValue(makeTauriUpdate({
      body: null,
      date: null,
    }));

    const result = await checkForUpdates();

    expect(result.status).toBe('update-available');
    if (result.status !== 'update-available') throw new Error('unreachable');
    expect(result.result.info.body).toBeUndefined();
    expect(result.result.info.date).toBeUndefined();
  });

  it('returns error with message when check() throws an Error', async () => {
    mockCheck.mockRejectedValue(new Error('Network unreachable'));

    const result = await checkForUpdates();

    expect(result).toEqual({ status: 'error', message: 'Network unreachable' });
  });

  it('returns error with stringified message when check() throws a non-Error', async () => {
    mockCheck.mockRejectedValue('something went wrong');

    const result = await checkForUpdates();

    expect(result).toEqual({ status: 'error', message: 'something went wrong' });
  });

  describe('downloadAndInstall wrapper', () => {
    it('calls the upstream downloadAndInstall and then relaunches', async () => {
      const upstreamInstall = vi.fn().mockResolvedValue(undefined);
      mockCheck.mockResolvedValue(makeTauriUpdate({ downloadAndInstall: upstreamInstall }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;
      await result.result.downloadAndInstall();

      expect(upstreamInstall).toHaveBeenCalledOnce();
      expect(mockRelaunch).toHaveBeenCalledOnce();
    });

    it('calls close() after downloadAndInstall completes', async () => {
      const upstreamInstall = vi.fn().mockResolvedValue(undefined);
      const upstreamClose = vi.fn().mockResolvedValue(undefined);
      mockCheck.mockResolvedValue(makeTauriUpdate({
        downloadAndInstall: upstreamInstall,
        close: upstreamClose,
      }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;
      await result.result.downloadAndInstall();

      expect(upstreamClose).toHaveBeenCalledOnce();
      // close should be called before relaunch
      const closeOrder = upstreamClose.mock.invocationCallOrder[0];
      const relaunchOrder = mockRelaunch.mock.invocationCallOrder[0];
      expect(closeOrder).toBeLessThan(relaunchOrder);
    });

    it('close() is idempotent — calling it twice does not call upstream close twice', async () => {
      const upstreamClose = vi.fn().mockResolvedValue(undefined);
      mockCheck.mockResolvedValue(makeTauriUpdate({ close: upstreamClose }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;

      await result.result.close();
      await result.result.close();

      expect(upstreamClose).toHaveBeenCalledOnce();
    });

    it('close() after downloadAndInstall is idempotent — upstream close called only once', async () => {
      const upstreamInstall = vi.fn().mockResolvedValue(undefined);
      const upstreamClose = vi.fn().mockResolvedValue(undefined);
      mockCheck.mockResolvedValue(makeTauriUpdate({
        downloadAndInstall: upstreamInstall,
        close: upstreamClose,
      }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;

      // downloadAndInstall calls close() internally
      await result.result.downloadAndInstall();
      expect(upstreamClose).toHaveBeenCalledOnce();

      // Explicit second call to close() should not trigger upstream again
      await result.result.close();
      expect(upstreamClose).toHaveBeenCalledOnce();
    });

    it('forwards progress events to the onProgress callback', async () => {
      const upstreamInstall = vi.fn().mockImplementation(async (cb: (event: unknown) => void) => {
        cb({ event: 'Started', data: { contentLength: 1024 } });
        cb({ event: 'Progress', data: { chunkLength: 256, contentLength: 1024 } });
        cb({ event: 'Finished', data: {} });
      });
      mockCheck.mockResolvedValue(makeTauriUpdate({ downloadAndInstall: upstreamInstall }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;
      const progress: unknown[] = [];
      await result.result.downloadAndInstall((event) => progress.push(event));

      expect(progress).toHaveLength(3);
      expect(progress[0]).toEqual({
        event: 'Started',
        data: { contentLength: 1024, chunkLength: undefined },
      });
      expect(progress[1]).toEqual({
        event: 'Progress',
        data: { chunkLength: 256, contentLength: 1024 },
      });
      expect(progress[2]).toEqual({
        event: 'Finished',
        data: {},
      });
    });

    it('does not throw when no onProgress callback is provided', async () => {
      const upstreamInstall = vi.fn().mockImplementation(async (cb: (event: unknown) => void) => {
        cb({ event: 'Started', data: { contentLength: 100 } });
        cb({ event: 'Finished', data: {} });
      });
      mockCheck.mockResolvedValue(makeTauriUpdate({ downloadAndInstall: upstreamInstall }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;
      // Should not throw when called without onProgress
      await expect(result.result.downloadAndInstall()).resolves.toBeUndefined();
    });

    it('propagates errors when upstream downloadAndInstall throws', async () => {
      const upstreamInstall = vi.fn().mockRejectedValue(new Error('Download failed'));
      mockCheck.mockResolvedValue(makeTauriUpdate({ downloadAndInstall: upstreamInstall }));

      const result = await checkForUpdates() as Extract<CheckResult, { status: 'update-available' }>;

      await expect(result.result.downloadAndInstall()).rejects.toThrow('Download failed');
      expect(mockRelaunch).not.toHaveBeenCalled();
    });
  });
});

// ---- Tests for updaterEnabled = false ----
// These tests reload the module with __MDEDIT_UPDATER_ENABLED__ set to false
// so that the module-level `updaterEnabled` const evaluates to false.

describe('checkForUpdates with updaterEnabled = false', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    // Override the define'd global before re-importing the module
    vi.stubGlobal('__MDEDIT_UPDATER_ENABLED__', false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns { status: "disabled" } and does not call check()', async () => {
    const { checkForUpdates: check } = await import('../src/lib/updater');
    const result = await check();

    expect(result).toEqual({ status: 'disabled' });
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

describe('startUpdateChecker with updaterEnabled = false', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.stubGlobal('__MDEDIT_UPDATER_ENABLED__', false);
    vi.useFakeTimers();
    mockRelaunch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns immediately without setting any timers when updaterEnabled is false', async () => {
    const { startUpdateChecker: start } = await import('../src/lib/updater');
    const onUpdate = vi.fn();

    start(onUpdate);

    // Advance well past startup delay and interval
    vi.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(mockCheck).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('startUpdateChecker / stopUpdateChecker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    mockRelaunch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopUpdateChecker();
    vi.useRealTimers();
  });

  it('calls onUpdate after the startup delay when an update is available', async () => {
    mockCheck.mockResolvedValue(makeTauriUpdate({ version: '5.0.0' }));
    const onUpdate = vi.fn();

    startUpdateChecker(onUpdate);

    // Before startup delay: no check yet
    expect(mockCheck).not.toHaveBeenCalled();

    // Advance past the 5-second startup delay
    vi.advanceTimersByTime(5_000);

    // Let the async checkForUpdates resolve
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0][0].info.version).toBe('5.0.0');
  });

  it('does not call onUpdate when no update is available', async () => {
    mockCheck.mockResolvedValue(null);
    const onUpdate = vi.fn();

    startUpdateChecker(onUpdate);

    vi.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledOnce();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not call onUpdate when check returns an error', async () => {
    mockCheck.mockRejectedValue(new Error('offline'));
    const onUpdate = vi.fn();

    startUpdateChecker(onUpdate);

    vi.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledOnce();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('sets up a periodic interval after the startup delay', async () => {
    mockCheck.mockResolvedValue(null);
    const onUpdate = vi.fn();

    startUpdateChecker(onUpdate);

    // Trigger startup delay
    vi.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledTimes(1);

    // Advance by 4 hours (the CHECK_INTERVAL_MS)
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledTimes(2);

    // Another 4 hours
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledTimes(3);
  });

  it('stopUpdateChecker prevents further checks', async () => {
    mockCheck.mockResolvedValue(null);
    const onUpdate = vi.fn();

    startUpdateChecker(onUpdate);

    // Trigger startup delay and first check
    vi.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledTimes(1);

    stopUpdateChecker();

    // Advance by 4 hours — should NOT trigger another check
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('stopUpdateChecker before startup delay fires prevents any checks', async () => {
    mockCheck.mockResolvedValue(makeTauriUpdate());
    const onUpdate = vi.fn();

    startUpdateChecker(onUpdate);
    stopUpdateChecker();

    // Advance well past the startup delay
    vi.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(mockCheck).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('calling startUpdateChecker again stops the previous checker', async () => {
    mockCheck.mockResolvedValue(null);
    const onUpdate1 = vi.fn();
    const onUpdate2 = vi.fn();

    startUpdateChecker(onUpdate1);

    // Advance partway (2 seconds) — not yet at startup delay
    vi.advanceTimersByTime(2_000);

    // Start a second checker — the first should be cancelled
    startUpdateChecker(onUpdate2);

    // Advance past what would have been the first startup delay
    vi.advanceTimersByTime(3_000);
    await flushMicrotasks();

    // The first onUpdate should never have been called (its timeout was cleared)
    expect(onUpdate1).not.toHaveBeenCalled();

    // The second hasn't fired yet (only 3s into its 5s delay)
    expect(mockCheck).not.toHaveBeenCalled();

    // Advance the remaining 2 seconds for the second checker's startup delay
    vi.advanceTimersByTime(2_000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledOnce();
  });

  it('multiple start/stop cycles do not leak timers', async () => {
    mockCheck.mockResolvedValue(makeTauriUpdate());
    const onUpdate = vi.fn();

    // Start and stop several times rapidly
    for (let i = 0; i < 5; i++) {
      startUpdateChecker(onUpdate);
      stopUpdateChecker();
    }

    // Advance a long time — no checks should fire
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    await flushMicrotasks();

    expect(mockCheck).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('multiple start calls without stop do not leak timers', async () => {
    mockCheck.mockResolvedValue(null);
    const callbacks = Array.from({ length: 5 }, () => vi.fn());

    // Each start should cancel the previous
    for (const cb of callbacks) {
      startUpdateChecker(cb);
    }

    // Only the last checker should fire
    vi.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(mockCheck).toHaveBeenCalledOnce();

    // Advance through one interval cycle
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    await flushMicrotasks();

    // Should only be 2 total checks (startup + 1 interval), not 10
    expect(mockCheck).toHaveBeenCalledTimes(2);
  });
});
