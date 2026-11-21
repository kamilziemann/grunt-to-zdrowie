import { describe, expect, it } from 'vitest';

import { createRecordingPurger } from './edge-cache';

describe('createRecordingPurger', () => {
  it('zapamietuje kolejne czyszczenia', async () => {
    const purger = createRecordingPurger();

    await purger.purge(['content']);
    await purger.purge(['site']);
    expect(purger.calls).toEqual([['content'], ['site']]);
  });
});
