import { describe, expect, it } from 'vitest';

import { tileBounds } from './tile-bounds';

describe('tileBounds', () => {
  it('kafel 0/0/0 to caly swiat w Web Mercator', () => {
    const [west, south, east, north] = tileBounds(0, 0, 0);

    expect([west, east]).toEqual([-180, 180]);
    expect(north).toBeCloseTo(85.0511, 3);
    expect(south).toBeCloseTo(-85.0511, 3);
  });

  it('kafel 16/36698/21596 zawiera dzialke z Minska Mazowieckiego (21.5898, 52.172)', () => {
    const [west, south, east, north] = tileBounds(16, 36_698, 21_596);

    expect(west).toBeLessThan(21.5898);
    expect(east).toBeGreaterThan(21.5898);
    expect(south).toBeLessThan(52.172);
    expect(north).toBeGreaterThan(52.172);
    expect(east - west).toBeCloseTo(360 / 65_536, 9);
  });
});
