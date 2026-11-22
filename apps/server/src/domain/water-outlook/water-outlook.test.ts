import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { MeteoSeries } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { addDays, addYears, daysBetween } from '../iso-date';
import { waterOutlook } from './water-outlook';

const FIELD: FieldArea = {
  id: 'area:test',
  kind: 'drawn',
  parcelIds: [],
  label: '',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [21.56, 52.17],
  bbox: [21.56, 52.17, 21.563, 52.172],
  areaHa: 5,
};

function meteo(date: string): MeteoSeries {
  const from = addDays(addYears(date, -10), -120);

  return {
    gridKm: 55,
    days: Array.from({ length: daysBetween(from, date) + 1 }, (_unused, index) => ({
      date: addDays(from, index),
      precipMm: index % 4 === 0 ? 6 : 0,
      tMinC: 10,
      tMaxC: 24,
      tMeanC: 17,
      et0Mm: 3,
    })),
  };
}

function input(date: string, overrides: Partial<StageInput> = {}): StageInput {
  return {
    field: FIELD,
    cropId: 'winter_wheat',
    date,
    crop: cropAtDate('winter_wheat', date),
    meteo: meteo(date),
    forecast: null,
    soil: null,
    terrain: null,
    hydro: null,
    vegetation: null,
    ...overrides,
  };
}

describe('waterOutlook', () => {
  it('data historyczna w sezonie: zbiornik, rachunek i 60 dni, bez prognozy i zdjec', () => {
    const outlook = waterOutlook(input('2018-06-15'));

    expect(Object.keys(outlook).toSorted()).toEqual(['dailySeries', 'waterLedger', 'waterNow']);
    expect(outlook.waterNow).toMatchObject({ growing: true, typicalYears: 10 });
    expect(outlook.waterNow).not.toHaveProperty('daysToStressWithForecast');
    expect(outlook.waterLedger).toMatchObject({ from: '2018-03-21', to: '2018-06-15' });
    expect(outlook.dailySeries).toHaveLength(60);
  });

  it('dzis z prognoza: prognoza w raporcie i odliczanie z prognoza', () => {
    const forecast = {
      issuedAt: '2026-06-15T05:00:00Z',
      days: Array.from({ length: 7 }, (_unused, index) => ({
        date: addDays('2026-06-15', index + 1),
        precipMm: 0,
        et0Mm: 3,
        tMinC: 12,
        tMaxC: 26,
      })),
    };
    const outlook = waterOutlook(input('2026-06-15', { forecast }), {
      id: 'forecast',
      provider: 'MET Norway',
      status: 'ok',
      sample: false,
    });

    expect(outlook.forecast?.days).toHaveLength(7);
    expect(outlook.forecast?.issuedAt).toBe('2026-06-15T05:00:00Z');
    expect(outlook.waterNow?.daysToStressWithForecast).toBe(outlook.waterNow?.daysToStressNoRain);
  });

  it('zima: zbiornik bez odliczania, bez rachunku (przed 21 marca)', () => {
    const outlook = waterOutlook(input('2018-01-20'));

    expect(outlook.waterNow).toMatchObject({ growing: false });
    expect(outlook.waterNow).not.toHaveProperty('daysToStressNoRain');
    expect(outlook).not.toHaveProperty('waterLedger');
  });

  it('bez pogody nie ma zadnego pola', () => {
    expect(waterOutlook(input('2018-06-15', { meteo: null }))).toEqual({});
  });
});
