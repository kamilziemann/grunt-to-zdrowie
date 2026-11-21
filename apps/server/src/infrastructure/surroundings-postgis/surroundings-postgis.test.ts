import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fieldFromGeometry } from '../../domain/field-area';
import type { SqlRunner } from '../hydro-postgis';
import biebrza from './surroundings-biebrza.recorded.json?raw';
import chwalim from './surroundings-chwalim.recorded.json?raw';
import junction from './surroundings-junction.recorded.json?raw';
import { createPostgisSurroundingsSource, surroundingsQueries } from './surroundings-postgis';

// Nagrania: odpowiedzi bazy (Neon, tabele otoczenia zaimportowane 21.11.2026) dla dzialki 080904_5.0001.349/1
// (Chwalim: jaz 347 m, 44 waly w 3 km, zadnych drzew przy granicy), prostokata w dolinie Biebrzy (22,60 E 53,45 N:
// park narodowy, dwa obszary Natura 2000, las przy granicy) i prostokata przy rowie wchodzacym w rure (22,85 E 54,04 N).
const rectangle = (lng: number, lat: number): FieldArea =>
  fieldFromGeometry({
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng, lat],
          [lng + 0.004, lat],
          [lng + 0.004, lat + 0.0024],
          [lng, lat + 0.0024],
          [lng, lat],
        ],
      ],
    },
    kind: 'drawn',
    parcelIds: [],
  });

const replay =
  (body: string): SqlRunner =>
  () =>
    Promise.resolve(JSON.parse(body) as Record<string, unknown>[][]);

describe('createPostgisSurroundingsSource', () => {
  it('Chwalim: granica bez drzew, jaz 347 m, waly; data danych = najnowszy import tabel otoczenia', async () => {
    const result = await createPostgisSurroundingsSource({ run: replay(chwalim) }).surroundings(
      rectangle(15.6, 52.1),
    );

    expect(result.data?.trees).toMatchObject({ edgeM: 1900, woodedEdgeM: 0, openToWind: true });
    expect(result.data?.water).toMatchObject({
      nearestStructure: { kind: 'weir', distanceM: 347, name: null },
      levees: 44,
      pipedJunction: null,
    });
    expect(result.data?.protectedAreas).toEqual([]);
    expect(result.source).toMatchObject({
      id: 'hydro',
      status: 'ok',
      fetchedAt: '2026-11-21T23:06:49.150Z',
    });
    expect(result.source.provider).toContain('otoczenie pola');
    expect(result.source.note).toContain('zastawek');
  });

  it('Biebrza: park narodowy i Natura 2000 po nazwach, pole oslonione lasem', async () => {
    const result = await createPostgisSurroundingsSource({ run: replay(biebrza) }).surroundings(
      rectangle(22.6, 53.45),
    );

    expect(result.data?.protectedAreas).toEqual([
      { kind: 'national_park', name: 'Biebrzański Park Narodowy' },
      { kind: 'natura2000', name: 'Dolina Biebrzy' },
      { kind: 'natura2000', name: 'Ostoja Biebrzańska' },
    ]);
    expect(result.data?.trees).toMatchObject({ woodedEdgeShare: 0.98, nearestForestM: 0, openToWind: false });
  });

  it('row wchodzi w rure 106 m od pola: punkt styku w WGS84', async () => {
    const result = await createPostgisSurroundingsSource({ run: replay(junction) }).surroundings(
      rectangle(22.853, 54.0395),
    );

    expect(result.data?.water.pipedJunction).toEqual({ distanceM: 106, point: [22.851388, 54.04103] });
    expect(result.data?.water.pipedSegments).toBe(2);
  });

  it('brak adresu bazy, blad bazy i niezaimportowane tabele to `missing` z powodem', async () => {
    const field = rectangle(15.6, 52.1);
    const noUrl = await createPostgisSurroundingsSource({ run: null }).surroundings(field);
    const failing = await createPostgisSurroundingsSource({
      run: () => Promise.reject(new Error('connection refused')),
    }).surroundings(field);
    const partialImport = await createPostgisSurroundingsSource({
      run: () =>
        Promise.resolve([
          [],
          [{ edge_m: 100, wooded_edge_m: 0 }],
          [],
          [],
          [],
          [{ table_name: 'bdot_cover', imported_at: '2026-11-21T22:52:19.801Z' }],
        ]),
    }).surroundings(field);

    expect([noUrl, failing, partialImport].map((result) => [result.data, result.source.status])).toEqual([
      [null, 'missing'],
      [null, 'missing'],
      [null, 'missing'],
    ]);
    expect(noUrl.source.note).toContain('DATABASE_URL');
    expect(failing.source.note).toContain('connection refused');
    expect(partialImport.source.note).toContain('nie jest zaimportowane');
  });

  it('kazde zapytanie tylko czyta i ma staly promien (indeks przestrzenny)', () => {
    const queries = surroundingsQueries(rectangle(15.6, 52.1));

    expect(queries).toHaveLength(6);
    expect(queries.map((query) => query.params[1])).toEqual([500, 15, 3000, 500, undefined, undefined]);
    expect(queries.every((query) => /^\s*(with|select)/i.test(query.text))).toBe(true);
    expect(queries.some((query) => /case\s+when/i.test(query.text))).toBe(false);
  });
});
