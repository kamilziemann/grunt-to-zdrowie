import { describe, expect, it } from 'vitest';

import { HISTORY_TTL_S, RECENT_TTL_S, sourceCacheTtl } from './source-cache-policy';

describe('sourceCacheTtl', () => {
  it('historia dlugo, ostatnie 10 dni krotko, bez daty - bez pamieci', () => {
    expect(sourceCacheTtl('2018-06-15', '2026-11-21')).toBe(HISTORY_TTL_S);
    expect(sourceCacheTtl('2026-11-10', '2026-11-21')).toBe(HISTORY_TTL_S);
    expect(sourceCacheTtl('2026-11-11', '2026-11-21')).toBe(RECENT_TTL_S);
    expect(sourceCacheTtl('2026-11-21', '2026-11-21')).toBe(RECENT_TTL_S);
    expect(sourceCacheTtl(null, '2026-11-21')).toBe(0);
  });
});
