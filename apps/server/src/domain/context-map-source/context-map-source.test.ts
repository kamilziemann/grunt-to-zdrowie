import { describe, expect, it } from 'vitest';

import { contextTileFromRows } from './context-map-source';

const line = {
  type: 'LineString',
  coordinates: [
    [21.5, 52.1],
    [21.51, 52.11],
  ],
};
const point = { type: 'Point', coordinates: [21.5, 52.1] };

describe('contextTileFromRows', () => {
  it('sieć wodna: jaz, źródło z nazwą (punkt), wał; kod innej warstwy i pusta geometria pominięte', () => {
    const tile = contextTileFromRows('waterworks', {
      rows: [
        { kind: 30, name: null, geometry: line },
        { kind: 34, name: 'Źródło Marii', geometry: point },
        { kind: 40, name: null, geometry: line },
        { kind: 20, name: null, geometry: line },
        { kind: 41, name: null, geometry: { type: 'GeometryCollection', geometries: [] } },
      ],
      importedAt: '2026-11-21T23:06:49.150Z',
    });

    expect(tile).toEqual({
      layer: 'waterworks',
      features: [
        { kind: 'weir', name: null, geometry: line },
        { kind: 'spring', name: 'Źródło Marii', geometry: point },
        { kind: 'levee', name: null, geometry: line },
      ],
      truncated: false,
      importedAt: '2026-11-21T23:06:49.150Z',
    });
  });

  it('nadmiar wierszy: ucina do limitu i ustawia `truncated`', () => {
    const rows = Array.from({ length: 4 }, () => ({ kind: 23, name: null, geometry: line }));
    const tile = contextTileFromRows('cover', { rows, importedAt: null }, 3);

    expect(tile.features).toHaveLength(3);
    expect(tile.features[0]?.kind).toBe('tree_row');
    expect(tile.truncated).toBe(true);
  });
});
