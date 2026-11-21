import { describe, expect, it } from 'vitest';

import {
  HTTP_STATUS_BY_CODE,
  HYDRO_TILE_ZOOM,
  PROBLEM_CODES,
  analysisFieldInputSchema,
  hydroTileQuerySchema,
  hydroTileSchema,
  listQuerySchema,
  problemDetailsSchema,
  problemType,
  signInInputSchema,
  signUpInputSchema,
} from './index';

describe('problems', () => {
  it('kazdy kod ma status HTTP', () => {
    for (const code of Object.values(PROBLEM_CODES)) expect(HTTP_STATUS_BY_CODE[code]).toBeGreaterThan(0);
  });

  it('Problem Details ma stabilny typ URN', () => {
    const problem = {
      type: problemType('not_found'),
      title: 'Not found',
      status: 404,
      code: 'not_found',
    };

    expect(problemDetailsSchema.parse(problem).type).toBe('urn:app:problem:not_found');
  });
});

describe('listQuerySchema', () => {
  it('domyslny limit i koercja ze stringa', () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
    expect(listQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('formularze auth', () => {
  it('rejestracja wymaga imienia, poprawnego e-maila i hasla 8+ znakow', () => {
    const ok = { name: ' Ala ', email: ' ala@example.com ', password: 'dlugie-haslo' };

    expect(signUpInputSchema.parse(ok)).toEqual({
      name: 'Ala',
      email: 'ala@example.com',
      password: 'dlugie-haslo',
    });
    expect(signUpInputSchema.safeParse({ ...ok, password: 'krotkie' }).success).toBe(false);
    expect(signUpInputSchema.safeParse({ ...ok, email: 'nie-email' }).success).toBe(false);
    expect(signUpInputSchema.safeParse({ ...ok, name: ' ' }).success).toBe(false);
  });

  it('logowanie wymaga e-maila i niepustego hasla', () => {
    expect(signInInputSchema.safeParse({ email: 'a@b.pl', password: 'x' }).success).toBe(true);
    expect(signInInputSchema.safeParse({ email: 'a@b.pl', password: '' }).success).toBe(false);
  });
});

describe('analysisFieldInputSchema', () => {
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [21.56, 52.17],
        [21.561, 52.17],
        [21.561, 52.171],
        [21.56, 52.17],
      ],
    ],
  };

  it('obszar wyciety z dzialki zachowuje geometrie, choc niesie tez identyfikator dzialki', () => {
    const parsed = analysisFieldInputSchema.parse({
      geometry,
      kind: 'part',
      parcelIds: ['141201_1.0001.6509'],
    });

    expect(parsed).toMatchObject({ kind: 'part', geometry, parcelIds: ['141201_1.0001.6509'] });
  });

  it('same identyfikatory dzialek to pole z dzialek', () => {
    const parsed = analysisFieldInputSchema.parse({ parcelIds: ['141201_1.0001.6509'] });

    expect(parsed).toEqual({ parcelIds: ['141201_1.0001.6509'] });
    expect(analysisFieldInputSchema.safeParse({ parcelIds: [] }).success).toBe(false);
  });
});

describe('hydrografia na mapie', () => {
  it('indeks kafla musi miescic sie w siatce przyblizenia', () => {
    expect(hydroTileQuerySchema.parse({ x: '9174', y: '5399' })).toEqual({ x: 9174, y: 5399 });
    expect(hydroTileQuerySchema.safeParse({ x: 2 ** HYDRO_TILE_ZOOM, y: 0 }).success).toBe(false);
  });

  it('kafel niesie linie i poligony z rodzajem obiektu', () => {
    const tile = hydroTileSchema.parse({
      features: [
        {
          kind: 'stream',
          name: 'Srebrna',
          geometry: {
            type: 'LineString',
            coordinates: [
              [21.56, 52.17],
              [21.57, 52.18],
            ],
          },
        },
      ],
      truncated: false,
      importedAt: '2026-11-21T20:40:00.000Z',
    });

    expect(tile.features[0]?.kind).toBe('stream');
  });
});
