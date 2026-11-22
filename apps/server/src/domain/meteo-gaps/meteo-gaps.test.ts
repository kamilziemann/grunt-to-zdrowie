import { describe, expect, it } from 'vitest';

import type { DailyWeather } from '../analysis-ports';
import { hasMeaningfulGaps, meteoGaps } from './meteo-gaps';

const day = (date: string, known = true): DailyWeather => ({
  date,
  precipMm: known ? 1 : null,
  tMinC: known ? 2 : null,
  tMaxC: known ? 8 : null,
  tMeanC: known ? 5 : null,
  et0Mm: null,
  solarMjM2: null,
  humidityPct: null,
  windMs: null,
});

const series = (pattern: string): DailyWeather[] =>
  pattern.split('').map((mark, index) => day(`2026-01-${String(index + 1).padStart(2, '0')}`, mark === 'x'));

describe('meteoGaps', () => {
  it('ostatnie dni bez danych to opóźnienie publikacji, nie luka', () => {
    const gaps = meteoGaps(series('xxxxxxxxxx....'));

    expect(gaps).toEqual({ lagDays: 4, gapDays: 0, totalDays: 14 });
    expect(hasMeaningfulGaps(gaps)).toBe(false);
  });

  it('luka w środku serii liczy się jako luka', () => {
    expect(meteoGaps(series('xxx..xxxx.'))).toEqual({ lagDays: 1, gapDays: 2, totalDays: 10 });
  });

  it('brak ponad tydzień na końcu to już luka, a nie opóźnienie', () => {
    const gaps = meteoGaps(series('xx........'));

    expect(gaps).toEqual({ lagDays: 0, gapDays: 8, totalDays: 10 });
    expect(hasMeaningfulGaps(gaps)).toBe(true);
  });

  it('pojedyncze luki poniżej 1% serii nie osłabiają oceny', () => {
    const pattern = `${'x'.repeat(200)}.${'x'.repeat(200)}`;

    expect(hasMeaningfulGaps(meteoGaps(series(pattern)))).toBe(false);
  });
});
