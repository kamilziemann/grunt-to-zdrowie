import type { ParcelOutline } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import {
  boundaryTileKey,
  boundaryTiles,
  boundaryTileZoom,
  coarseParent,
  outlineCollections,
  planBoundaryTiles,
  type BoundaryTileState,
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

  describe('plan kafli widoku', () => {
    // ok. 375 x 560 px przy przyblizeniu 15 w srodku kafla z14 9174/5399 (Minsk Mazowiecki)
    const view = [21.583, 52.165, 21.591, 52.1725] as const;
    const known =
      (entries: Record<string, BoundaryTileState>) =>
      (key: string): BoundaryTileState =>
        entries[key];

    it('pelne kafle z14: bez podpowiedzi, bez kafli z16', () => {
      const plan = planBoundaryTiles(view, 15.2, known({}));

      expect(plan?.tiles.every((tile) => tile.z === 14)).toBe(true);
      expect(plan?.zoomHint).toBe(false);
    });

    it('obciety kafel z14 przy 15+: od razu jego kafle z16 w widoku, bez ponownego pytania o z14', () => {
      const plan = planBoundaryTiles(view, 15.2, known({ '14/9174/5399': 'truncated' }));
      const fine = plan?.tiles.filter((tile) => tile.z === 16) ?? [];

      expect(fine.length).toBeGreaterThan(0);
      expect(fine.length).toBeLessThanOrEqual(24);
      expect(fine.every((tile) => boundaryTileKey(coarseParent(tile)) === '14/9174/5399')).toBe(true);
      expect(plan?.tiles.map(boundaryTileKey)).not.toContain('14/9174/5399');
      expect(plan?.zoomHint).toBe(false);
    });

    it('obciety kafel z14 przy 14-15: podpowiedz "przybliz", bez kafli z16', () => {
      const plan = planBoundaryTiles(view, 14.6, known({ '14/9174/5399': 'truncated' }));

      expect(plan?.tiles.some((tile) => tile.z === 16)).toBe(false);
      expect(plan?.zoomHint).toBe(true);
    });

    it('za duzo kafli z16 na zastepstwo (komputer przy 15): najwyzej 24 najblizej srodka, reszta z podpowiedzia', () => {
      // ok. 1000 x 700 px przy przyblizeniu 15, wszystkie kafle z14 obciete (srodek miasta)
      const wide = [21.57, 52.16, 21.613, 52.18] as const;
      const focus = [21.6, 52.17] as const;
      const plan = planBoundaryTiles(wide, 15.1, () => 'truncated', focus);
      const fine = plan?.tiles.filter((tile) => tile.z === 16) ?? [];
      const distance = (tile: { x: number; y: number }) => Math.hypot(tile.x - 36_700, tile.y - 21_597);

      expect(fine).toHaveLength(24);
      expect(Math.max(...fine.map(distance))).toBeLessThan(4);
      expect(plan?.zoomHint).toBe(true);
    });

    it('od 16 kafle z16 tylko tam, gdzie pelnego kafla z14 nie ma w pamieci', () => {
      expect(planBoundaryTiles(view, 16.5, known({ '14/9174/5399': 'full' }))?.tiles).toEqual([]);
      expect(planBoundaryTiles(view, 16.5, known({}))?.tiles.length).toBeGreaterThan(0);
    });
  });
});
