import { describe, expect, it } from 'vitest';

import { encodeRing } from '@/lib/field-geometry';

import {
  analysisDateBounds,
  analysisRequestFromSearch,
  analysisSearchOf,
  analysisSearchSchema,
  todayInPoland,
  validateAnalysisDate,
} from './analysis-search.schema';

const ID = '141201_1.0001.6509';

describe('parametry analizy w adresie', () => {
  it('zle wartosci nie wywracaja strony, tylko znikaja', () => {
    expect(analysisSearchSchema.parse({ dzialki: ID, uprawa: 'banan', data: '2026-13-40' })).toEqual({
      dzialki: ID,
      uprawa: undefined,
      data: undefined,
    });
  });

  it('komplet parametrow daje zadanie analizy, brak czegokolwiek = null', () => {
    expect(analysisRequestFromSearch({ dzialki: ID, uprawa: 'potato', data: '2025-07-01' })).toEqual({
      field: { parcelIds: [ID] },
      cropId: 'potato',
      date: '2025-07-01',
    });
    expect(analysisRequestFromSearch({ dzialki: ID, uprawa: 'potato' })).toBeNull();
    expect(
      analysisRequestFromSearch({ dzialki: 'zly-numer', uprawa: 'potato', data: '2025-07-01' }),
    ).toBeNull();
  });

  it('zadanie i parametry adresu przechodza w obie strony', () => {
    const search = analysisSearchOf({ parcelIds: [ID], cropId: 'hops', date: '2024-05-01' });

    expect(search).toEqual({ dzialki: ID, uprawa: 'hops', data: '2024-05-01' });
    expect(analysisRequestFromSearch(analysisSearchSchema.parse(search))?.cropId).toBe('hops');
  });
});

describe('zakres dat', () => {
  it('dzis w Polsce, takze tuz po polnocy czasu polskiego', () => {
    expect(todayInPoland(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
  });

  it('ostatnie 10 lat do dzis; 29 lutego cofa sie na 28 lutego', () => {
    expect(analysisDateBounds('2026-11-21')).toEqual({ min: '2016-11-21', max: '2026-11-21' });
    expect(analysisDateBounds('2028-02-29').min).toBe('2018-02-28');
  });

  it('nazywa blad daty', () => {
    expect(validateAnalysisDate('2026-11-21', '2026-11-21')).toBeNull();
    expect(validateAnalysisDate('2016-11-21', '2026-11-21')).toBeNull();
    expect(validateAnalysisDate('2026-11-22', '2026-11-21')).toBe('future');
    expect(validateAnalysisDate('2016-11-20', '2026-11-21')).toBe('tooOld');
    expect(validateAnalysisDate('', '2026-11-21')).toBe('invalid');
  });
});

describe('wlasny obszar w adresie', () => {
  const ring: [number, number][] = [
    [21.5, 52.17],
    [21.502, 52.17],
    [21.502, 52.171],
  ];

  it('obszar ma pierwszenstwo przed dzialkami i trafia do zadania jako geometria', () => {
    const obszar = encodeRing(ring);
    const request = analysisRequestFromSearch({
      dzialki: '141201_1.0001.6509',
      obszar,
      rodzaj: 'part',
      uprawa: 'winter_wheat',
      data: '2026-06-15',
    });

    // dzialki tylko w opisie: API przy niepustej liscie wybiera wariant "cale dzialki"
    expect(request?.field).toMatchObject({ kind: 'part', parcelIds: [] });
    expect(
      analysisRequestFromSearch(
        { dzialki: '141201_1.0001.6509', obszar, rodzaj: 'part', uprawa: 'winter_wheat', data: '2026-06-15' },
        (kind, numbers) => `${kind}:${numbers.join(',')}`,
      )?.field,
    ).toMatchObject({ label: 'part:6509' });
    expect(request?.field && 'geometry' in request.field ? request.field.geometry.type : null).toBe(
      'Polygon',
    );
    expect(
      analysisSearchOf({
        parcelIds: [],
        cropId: 'winter_wheat',
        date: '2026-06-15',
        obszar,
        rodzaj: 'drawn',
      }),
    ).toEqual({
      dzialki: undefined,
      obszar,
      rodzaj: 'drawn',
      uprawa: 'winter_wheat',
      data: '2026-06-15',
    });
  });

  it('uszkodzony obszar = brak zadania (raport prosi o ponowny wybor)', () => {
    expect(
      analysisRequestFromSearch({ obszar: '!!', uprawa: 'winter_wheat', data: '2026-06-15' }),
    ).toBeNull();
  });
});
