import { describe, expect, it } from 'vitest';

import { CACHE_POLICIES } from './policies';

describe('polityki cache', () => {
  it('brzeg uzywa max-age + SWR (bez s-maxage, ktory wylacza SWR w Workers Cache)', () => {
    for (const policy of Object.values(CACHE_POLICIES)) {
      if (!policy.edge) continue;
      expect(policy.edge).toMatch(/max-age=\d+, stale-while-revalidate=\d+/);
      expect(policy.edge).not.toContain('s-maxage');
    }
  });

  it('dane prywatne omijaja cache', () => {
    expect(CACHE_POLICIES.private).toEqual({ edge: null, browser: 'private, no-store' });
  });
});
