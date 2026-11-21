import { describe, expect, it } from 'vitest';

import { BDOT_MAP_KINDS, hydroTileFromRows } from './hydro-map-source';

const line = {
  type: 'LineString',
  coordinates: [
    [21.5, 52.1],
    [21.51, 52.11],
  ],
};

describe('hydroTileFromRows', () => {
  it('mapuje wszystkie osiem kodow BDOT10k na rodzaje kontraktu', () => {
    expect(Object.values(BDOT_MAP_KINDS)).toEqual([
      'ditch',
      'river',
      'stream',
      'canal',
      'standing_water',
      'flowing_water',
      'wetland',
      'bog',
    ]);
  });

  it('oddaje obiekty z nazwa i data importu, pomija nieznane kody i geometrie bez linii ani poligonu', () => {
    const tile = hydroTileFromRows({
      rows: [
        { kind: 2, name: 'Srebrna', geometry: line },
        { kind: 1, name: null, geometry: { type: 'Point', coordinates: [21.5, 52.1] } },
        { kind: 9, name: null, geometry: line },
        {
          kind: 5,
          name: null,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [21.5, 52.1],
                [21.51, 52.1],
                [21.51, 52.11],
                [21.5, 52.1],
              ],
            ],
          },
        },
      ],
      importedAt: '2026-11-20T10:00:00.000Z',
    });

    expect(tile.truncated).toBe(false);
    expect(tile.importedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(tile.features.map((feature) => [feature.kind, feature.name])).toEqual([
      ['river', 'Srebrna'],
      ['standing_water', null],
    ]);
  });

  it('przy nadmiarze ucina do limitu i ustawia truncated', () => {
    const rows = Array.from({ length: 4 }, () => ({ kind: 1, name: null, geometry: line }));
    const tile = hydroTileFromRows({ rows, importedAt: null }, 3);

    expect(tile.features).toHaveLength(3);
    expect(tile.truncated).toBe(true);
  });
});
