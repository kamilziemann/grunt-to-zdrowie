import { describe, expect, it } from 'vitest';

import type { PolygonGeometry, Ring } from '../../domain/parcel-geometry';
import { mergeParcels, signedArea } from './merge-parcels';

function square(x: number, y: number, size = 1, clockwise = false): PolygonGeometry {
  const ring: Ring = [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];

  return { type: 'Polygon', coordinates: [clockwise ? ring.toReversed() : ring] };
}

function area(geometry: PolygonGeometry | null): number {
  if (!geometry) return 0;

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  return polygons.reduce((sum, rings) => sum + rings.reduce((inner, ring) => inner + signedArea(ring), 0), 0);
}

describe('mergeParcels', () => {
  it('dwie sasiednie dzialki (rozny kierunek obrysu) = jeden wielokat bez wspolnej granicy', () => {
    const merged = mergeParcels([square(0, 0), square(1, 0, 1, true)]);

    expect(merged?.type).toBe('Polygon');
    expect(merged?.coordinates).toHaveLength(1);
    expect(area(merged)).toBeCloseTo(2, 9);
    // 6 wierzcholkow obwodu + zamkniecie; wspolna krawedz x = 1 zniknela
    expect(merged?.type === 'Polygon' ? merged.coordinates[0] : []).toHaveLength(7);
  });

  it('osiem dzialek wokol cudzej = wielokat z dziura', () => {
    const ring = [0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => [x, y] as const));
    const merged = mergeParcels(ring.filter(([x, y]) => x !== 1 || y !== 1).map(([x, y]) => square(x, y)));

    expect(merged?.type).toBe('Polygon');
    expect(merged?.coordinates).toHaveLength(2);
    expect(area(merged)).toBeCloseTo(8, 9);
  });

  it('dzialki daleko od siebie = kilka rozlacznych czesci', () => {
    const merged = mergeParcels([square(0, 0), square(5, 5)]);

    expect(merged?.type).toBe('MultiPolygon');
    expect(area(merged)).toBeCloseTo(2, 9);
  });

  it('nie zgaduje: wierzcholek tylko po jednej stronie granicy, styk w punkcie, dzialka z dziura', () => {
    const tall: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [1, 0],
          [2, 0],
          [2, 2],
          [1, 2],
          [1, 0],
        ],
      ],
    };
    const withHole: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        ...(square(0, 0, 4).coordinates as Ring[]),
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 1],
        ],
      ],
    };

    expect(mergeParcels([square(0, 0), square(0, 1), tall])).toBeNull();
    expect(mergeParcels([square(0, 0), square(1, 1)])).toBeNull();
    expect(mergeParcels([withHole, square(4, 0)])).toBeNull();
    expect(mergeParcels([square(3, 3)])).toEqual(square(3, 3));
  });
});
