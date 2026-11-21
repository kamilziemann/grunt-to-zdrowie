import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fieldFromGeometry } from '../../domain/field-area';
import { createPostgisHydroSource, hydroQueries, type SqlRunner } from './hydro-postgis';
import minsk from './hydro-minsk.recorded.json?raw';
import zulawy from './hydro-zulawy.recorded.json?raw';

// Nagrania: odpowiedzi bazy (Neon, BDOT10k zaimportowany 21.11.2026) dla prostokatow ok. 205 x 167 m od punktow
// 52,17 N 21,56 E (Minsk Mazowiecki: rzeka Srebrna obok, jeden row w 211 m) i 54,20 N 19,05 E (Zulawy: row przez
// pole, 106 odcinkow rowow w 500 m).
const rectangle = (lng: number, lat: number): FieldArea =>
  fieldFromGeometry({
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng, lat],
          [lng + 0.003, lat],
          [lng + 0.003, lat + 0.0015],
          [lng, lat + 0.0015],
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

describe('createPostgisHydroSource', () => {
  it('Zulawy: row przecina pole, odleglosc 0 i dlugosc rowow wewnatrz pola', async () => {
    const result = await createPostgisHydroSource({ run: replay(zulawy) }).context(rectangle(19.05, 54.2));

    expect(result.data).toMatchObject({
      searchRadiusM: 500,
      nearestDitchM: 0,
      ditchesInRadius: 106,
      ditchLengthInFieldM: 245,
      nearestWatercourseM: null,
      nearestWaterBodyM: 175,
      waterBodies: 2,
      wetlands: 0,
      treeCoverShare: null,
    });
    expect(result.data?.features.length).toBeGreaterThan(50);
    expect(result.source).toMatchObject({ id: 'hydro', status: 'ok', sample: false });
    expect(result.source.fetchedAt).toBe('2026-11-21T20:40:36.816Z');
  });

  it('Minsk: najblizszy ciek z nazwa, row dalej, brak wody stojacej to wynik, nie brak danych', async () => {
    const result = await createPostgisHydroSource({ run: replay(minsk) }).context(rectangle(21.56, 52.17));

    expect(result.data).toMatchObject({
      nearestWatercourseM: 45,
      nearestWatercourseName: 'Srebrna',
      nearestDitchM: 211,
      nearestWaterBodyM: null,
      ditchLengthInFieldM: 0,
    });
    expect(result.data?.features.every((feature) => feature.coordinates.length >= 2)).toBe(true);
  });

  it('brak adresu bazy, blad bazy i pusty import to `missing` z powodem', async () => {
    const field = rectangle(21.56, 52.17);
    const noUrl = await createPostgisHydroSource({ run: null }).context(field);
    const failing = await createPostgisHydroSource({
      run: () => Promise.reject(new Error('connection refused')),
    }).context(field);
    const empty = await createPostgisHydroSource({ run: () => Promise.resolve([[], [], [{}]]) }).context(
      field,
    );

    expect([noUrl, failing, empty].map((result) => [result.data, result.source.status])).toEqual([
      [null, 'missing'],
      [null, 'missing'],
      [null, 'missing'],
    ]);
    expect(noUrl.source.note).toContain('DATABASE_URL');
    expect(failing.source.note).toContain('connection refused');
  });

  it('pyta o poligon pola w WGS84 i promien 500 m, tylko odczyt', () => {
    const queries = hydroQueries(rectangle(21.56, 52.17));

    expect(queries).toHaveLength(3);
    expect(queries[0]?.params[1]).toBe(500);
    expect(JSON.parse(String(queries[0]?.params[0]))).toMatchObject({ type: 'Polygon' });
    expect(queries.every((query) => /^\s*(with|select)/i.test(query.text))).toBe(true);
    // rejestr importu jest wspolny z tabelami otoczenia - data danych tylko dla hydrografii
    expect(queries[2]?.text).toContain("where table_name = 'bdot_hydro'");
  });
});
