import { describe, it, expect } from 'vitest';

describe('core', () => {
  it('should be importable', async () => {
    const core = await import('../src/index');
    expect(core).toBeDefined();
  });
});
