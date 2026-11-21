import { createLogger } from '@app/logger';
import { describe, expect, it, vi } from 'vitest';

import { createEdgeCachePurger, type WorkersCache } from './edge-cache';

const silent = createLogger({ level: 'silent' });

describe('createEdgeCachePurger', () => {
  it('przekazuje tagi do cache.purge', async () => {
    const purge = vi.fn<WorkersCache['purge']>(async () => ({ success: true }));

    await createEdgeCachePurger(silent, { purge }).purge(['content', 'article:a']);
    expect(purge).toHaveBeenCalledWith({ tags: ['content', 'article:a'] });
  });

  it('nie rzuca, gdy purge sie nie udal albo runtime nie ma cache', async () => {
    const failing = {
      purge: vi.fn<WorkersCache['purge']>(async () => ({
        success: false,
        errors: [{ code: 429, message: 'rate' }],
      })),
    };

    await expect(createEdgeCachePurger(silent, failing).purge(['content'])).resolves.toBeUndefined();
    await expect(createEdgeCachePurger(silent, undefined).purge(['content'])).resolves.toBeUndefined();
  });

  it('pusta lista nie woła purge', async () => {
    const purge = vi.fn<WorkersCache['purge']>(async () => ({ success: true }));

    await createEdgeCachePurger(silent, { purge }).purge([]);
    expect(purge).not.toHaveBeenCalled();
  });
});
