import type { ParcelGeometry } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fromUtm, toUtm } from '../utm';
import { cellsInField, cellsOutline, fieldGrid, type GridSpec } from './field-grid';

/** Prostokat w metrach UTM strefy 34 od punktu (easting, northing) jako geometria WGS84. */
function rectangle(easting: number, northing: number, width: number, height: number): ParcelGeometry {
  const corners: [number, number][] = [
    [easting, northing],
    [easting + width, northing],
    [easting + width, northing + height],
    [easting, northing + height],
    [easting, northing],
  ];

  return { type: 'Polygon', coordinates: [corners.map(([e, n]) => fromUtm(e, n, 34))] };
}

const SPEC: GridSpec = {
  zone: 34,
  epsg: 32_634,
  west: 600_000,
  north: 5_780_000,
  cellSizeM: 10,
  cols: 5,
  rows: 5,
};

/** Wierzcholki obrysu z powrotem w komorkach siatki (kolumna, wiersz). */
function asCells(ring: [number, number][]): [number, number][] {
  return ring.map(([lng, lat]) => {
    const [e, n] = toUtm(lng, lat, 34);

    // + 0 zamienia -0 na 0 (toEqual je rozroznia)
    return [Math.round((e - SPEC.west) / 10) + 0, Math.round((SPEC.north - n) / 10) + 0];
  });
}

describe('fieldGrid i cellsInField', () => {
  it('siatka wyrownana do wielokrotnosci 10 m; 100 x 100 m to 100 komorek', () => {
    const geometry = rectangle(600_003, 5_780_004, 100, 100);
    const spec = fieldGrid(geometry, 21.4, 1);

    expect(spec).toMatchObject({ zone: 34, epsg: 32_634, cellSizeM: 10, west: 600_000, north: 5_780_110 });
    expect(spec.west % 10).toBe(0);
    expect(cellsInField(spec, geometry)).toHaveLength(100);
  });

  it('duze pole dostaje wieksze komorki, zeby bylo ich najwyzej 5000', () => {
    expect(fieldGrid(rectangle(600_000, 5_780_000, 1000, 1000), 21.4, 100).cellSizeM).toBe(20);
    expect(fieldGrid(rectangle(600_000, 5_780_000, 100, 100), 21.4, 1).cellSizeM).toBe(10);
  });
});

describe('cellsOutline', () => {
  it('ksztalt L: jeden wielokat, tylko narozniki, przeciwnie do wskazowek zegara na mapie', () => {
    // komorki (wiersz, kolumna): (0,0) (1,0) (1,1)
    const outline = cellsOutline(SPEC, [0, 5, 6]);

    expect(outline.type).toBe('Polygon');

    const [ring = []] = outline.type === 'Polygon' ? outline.coordinates : [];

    // na mapie (wiersze w dol = poludnie): wschod, polnoc, zachod, polnoc, zachod, poludnie
    expect(asCells(ring)).toEqual([
      [0, 2],
      [2, 2],
      [2, 1],
      [1, 1],
      [1, 0],
      [0, 0],
      [0, 2],
    ]);
  });

  it('pierscien komorek wokol pustego srodka: wielokat z dziura', () => {
    const ring = [0, 1, 2, 5, 7, 10, 11, 12];
    const outline = cellsOutline(SPEC, ring);

    expect(outline.type).toBe('Polygon');
    expect(outline.type === 'Polygon' ? outline.coordinates : []).toHaveLength(2);
  });

  it('komorki styczne tylko rogiem to dwie czesci', () => {
    const outline = cellsOutline(SPEC, [0, 6]);

    expect(outline.type).toBe('MultiPolygon');
    expect(outline.type === 'MultiPolygon' ? outline.coordinates : []).toHaveLength(2);
  });
});
