import type { ParcelOutline } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import {
  boundaryTileKey,
  boundaryTiles,
  boundaryTileZoom,
  coarseParent,
  outlineCollections,
} from './map-config';

const OUTLINE: ParcelOutline = {
  id: '141201_1.0001.6509',
  number: '6509',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.589876, 52.17167],
        [21.590427, 52.172262],
        [21.589704, 52.172208],
        [21.589876, 52.17167],
      ],
    ],
  },
  center: [21.59, 52.172],
};

describe('siatka granic dzialek', () => {
  it('ponizej przyblizenia 16 kafle z14, od 16 kafle z16', () => {
    expect(boundaryTileZoom(14)).toBe(14);
    expect(boundaryTileZoom(15.99)).toBe(14);
    expect(boundaryTileZoom(16)).toBe(16);
    expect(boundaryTileZoom(18.4)).toBe(16);
  });

  it('kafel z16 lezy w kaflu z14 o czterokrotnie wiekszych indeksach', () => {
    expect(coarseParent({ x: 36_698, y: 21_596, z: 16 })).toEqual({ x: 9174, y: 5399, z: 14 });
    expect(coarseParent({ x: 9174, y: 5399, z: 14 })).toEqual({ x: 9174, y: 5399, z: 14 });
    expect(boundaryTileKey({ x: 9174, y: 5399, z: 14 })).toBe('14/9174/5399');
  });

  it('widok telefonu przy przyblizeniu 14 to kilka kafli z14 (a nie kilkadziesiat z16)', () => {
    // ok. 375 x 560 px przy przyblizeniu 14 nad Minskiem Mazowieckim
    const view = [21.582, 52.165, 21.598, 52.18] as const;

    expect(boundaryTiles(...view, 14).length).toBeLessThanOrEqual(4);
    expect(boundaryTiles(...view, 16).length).toBeGreaterThanOrEqual(12);
  });

  it('obciety kafel nie jest rysowany, a dzialka z dwoch kafli wchodzi raz', () => {
    const full = { truncated: false, items: [OUTLINE] };
    const cut = { truncated: true, items: [{ ...OUTLINE, id: 'other' }] };
    const { lines, labels } = outlineCollections([full, full, cut]);

    expect(lines.features.map((feature) => feature.properties?.id)).toEqual([OUTLINE.id]);
    expect(labels.features).toHaveLength(1);
  });
});
