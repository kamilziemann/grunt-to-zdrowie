import { describe, expect, it } from 'vitest';

import type { DailyWeather } from '../analysis-ports';
import { addDays, daysBetween } from '../iso-date';
import { climaticWaterBalance, decadeOf, doroszewskiGorskiEtp } from './climatic-water-balance';

const LAT = 52.17;

function series(from: string, to: string, day: Partial<DailyWeather> = {}): DailyWeather[] {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_unused, index) => ({
    date: addDays(from, index),
    precipMm: 1,
    tMinC: 12,
    tMaxC: 25,
    tMeanC: 18.5,
    et0Mm: null,
    solarMjM2: 19,
    humidityPct: 70,
    windMs: 2.5,
    ...day,
  }));
}

describe('doroszewskiGorskiEtp', () => {
  it('lipiec: t = 19 C, h = 250 h, f = 16,3 h -> 124,0 mm (przeliczenie reczne)', () => {
    expect(doroszewskiGorskiEtp(19, 250, 16.3)).toBeCloseTo(123.99, 2);
  });

  it('zima nie daje ujemnego parowania', () => {
    expect(doroszewskiGorskiEtp(-5, 30, 8)).toBe(0);
  });
});

describe('decadeOf', () => {
  it('dzieli miesiac na 1-10, 11-20 i 21-koniec (takze luty i miesiace 31-dniowe)', () => {
    expect(decadeOf('2024-02-25')).toEqual({ from: '2024-02-21', to: '2024-02-29' });
    expect(decadeOf('2023-07-31')).toEqual({ from: '2023-07-21', to: '2023-07-31' });
    expect(decadeOf('2023-07-11')).toEqual({ from: '2023-07-11', to: '2023-07-20' });
    expect(decadeOf('2023-07-01')).toEqual({ from: '2023-07-01', to: '2023-07-10' });
  });
});

describe('climaticWaterBalance', () => {
  it('typowe lato: ETP czerwca i lipca rzedu sredniej IUNG dla Polski (114 + 118 mm), opad sumowany wprost', () => {
    const kbw = climaticWaterBalance(series('2023-05-01', '2023-08-31'), '2023-06-01', '2023-07-31', LAT);

    expect(kbw.precipMm).toBe(61);
    expect(kbw.evapotranspirationMm).toBeGreaterThan(200);
    expect(kbw.evapotranspirationMm).toBeLessThan(270);
    expect(kbw.balanceMm).toBeCloseTo((kbw.precipMm ?? 0) - (kbw.evapotranspirationMm ?? 0), 1);
    expect(kbw.coverage).toBe(1);
  });

  it('wiecej slonca i ciepla = wieksze ETP i nizszy bilans', () => {
    const mild = climaticWaterBalance(series('2023-06-01', '2023-07-31'), '2023-06-01', '2023-07-31', LAT);
    const hot = climaticWaterBalance(
      series('2023-06-01', '2023-07-31', { tMeanC: 24, tMinC: 16, tMaxC: 32, solarMjM2: 25, precipMm: 0.3 }),
      '2023-06-01',
      '2023-07-31',
      LAT,
    );

    expect(hot.evapotranspirationMm).toBeGreaterThan(mild.evapotranspirationMm ?? 0);
    expect(hot.balanceMm).toBeLessThan((mild.balanceMm ?? 0) - 50);
  });

  it('luki do 10% okresu licza sie z dni znanych, wieksze daja brak wyniku', () => {
    const fewGaps = series('2023-06-01', '2023-07-31');
    const manyGaps = series('2023-06-01', '2023-07-31');

    for (const day of fewGaps.slice(55)) day.precipMm = null;

    for (const day of manyGaps.slice(50)) Object.assign(day, { tMaxC: null, tMeanC: null });

    expect(climaticWaterBalance(fewGaps, '2023-06-01', '2023-07-31', LAT)).toMatchObject({
      precipMm: 55,
      coverage: 0.9,
    });
    expect(climaticWaterBalance(manyGaps, '2023-06-01', '2023-07-31', LAT)).toMatchObject({
      balanceMm: null,
      precipMm: null,
    });
  });

  it('bez promieniowania liczy ETP z temperatur (Hargreaves) zamiast przerywac', () => {
    const kbw = climaticWaterBalance(
      series('2023-06-01', '2023-07-31', { solarMjM2: null }),
      '2023-06-01',
      '2023-07-31',
      LAT,
    );

    expect(kbw.evapotranspirationMm).toBeGreaterThan(150);
    expect(kbw.evapotranspirationMm).toBeLessThan(350);
  });
});
