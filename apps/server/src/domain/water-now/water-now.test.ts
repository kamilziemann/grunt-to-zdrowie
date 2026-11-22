import { describe, expect, it } from 'vitest';

import { addDays } from '../iso-date';
import type { RootZoneDay } from '../root-zone-balance';
import { availablePctOf, daysToStress, median, typicalAvailablePct, waterNow } from './water-now';

/** Dzien bilansu pszenicy ozimej: TAW 150 mm (100 mm/m x 1,5 m), p = 0,55 -> RAW 82,5 mm. */
function day(date: string, depletionMm: number, overrides: Partial<RootZoneDay> = {}): RootZoneDay {
  const kc = overrides.kc === undefined ? 1.15 : overrides.kc;
  const et0Mm = overrides.et0Mm ?? 4;

  return {
    date,
    kc,
    rootDepthM: 1.5,
    et0Mm,
    totalAvailableMm: 150,
    readilyAvailableMm: 82.5,
    depletionMm,
    stressCoefficient: depletionMm > 82.5 ? (150 - depletionMm) / (0.45 * 150) : 1,
    potentialEtcMm: (kc ?? 0.35) * et0Mm,
    actualEtcMm: (kc ?? 0.35) * et0Mm,
    precipMm: 0,
    startDepletionMm: depletionMm,
    deepPercolationMm: 0,
    ...overrides,
  };
}

/** Ostatnie 7 dni do daty analizy (ET0 4 mm/d) i wyczerpanie w dniu analizy. */
function lastWeek(date: string, depletionMm: number, previous = depletionMm): RootZoneDay[] {
  return Array.from({ length: 7 }, (_unused, index) =>
    day(addDays(date, index - 6), index === 6 ? depletionMm : previous),
  );
}

describe('waterNow - przeliczone recznie', () => {
  // TAW 150, Dr 60 -> zostalo 90 mm = 60%; prog stresu (1 - 0,55) 100 = 45%. Kc w polowie czerwca 1,15 (faza
  // srodkowa do 3 lipca), zuzycie 1,15 x 4 = 4,6 mm/d: Dr > 82,5 po 5 dniach (60 + 5 x 4,6 = 83).
  // Z prognoza: jutro 10 mm deszczu -> 54,6 mm, potem 4,6 mm/d -> przekroczenie 7 dni pozniej, czyli dnia 8.
  const DATE = '2018-06-15';
  const background = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135].map((depletion, index) =>
    day(`${2008 + index}-06-15`, depletion),
  );
  const days = [...background, ...lastWeek(DATE, 60)];

  it('zapas, typowo, prog stresu i odliczanie bez deszczu', () => {
    expect(waterNow({ cropId: 'winter_wheat', date: DATE, days, forecast: null })).toEqual({
      growing: true,
      availablePct: 60,
      // procenty lat tla: 100, 90, ..., 10 -> mediana (60 + 50) / 2 = 55
      typicalPct: 55,
      typicalYears: 10,
      stressBelowPct: 45,
      availableMm: 90,
      capacityMm: 150,
      rootDepthM: 1.5,
      daysToStressNoRain: 5,
      horizonDays: 60,
      recentUseMmPerDay: 4.6,
      basis: expect.stringContaining('nie pomiar'),
    });
  });

  it('z prognoza deszcz odsuwa stres', () => {
    const forecast = {
      days: [
        { date: '2018-06-16', precipMm: 10, et0Mm: 4, tMinC: 12, tMaxC: 24 },
        { date: '2018-06-17', precipMm: 0, et0Mm: null, tMinC: null, tMaxC: null },
      ],
    };
    const now = waterNow({ cropId: 'winter_wheat', date: DATE, days, forecast });

    expect(now).toMatchObject({ daysToStressNoRain: 5, daysToStressWithForecast: 8 });
  });

  it('stres juz trwa: 0 dni i od ilu dni z rzedu', () => {
    const stressed = [day('2018-06-12', 80), day('2018-06-13', 85), day('2018-06-14', 90), day(DATE, 95)];
    const now = waterNow({ cropId: 'winter_wheat', date: DATE, days: stressed, forecast: null });

    expect(now).toMatchObject({
      availablePct: 37,
      daysToStressNoRain: 0,
      stressedSinceDays: 3,
    });
    // bez lat tla nie ma "typowo"
    expect(now).not.toHaveProperty('typicalPct');
  });

  it('poza sezonem uprawy tylko zapas - bez progu i odliczania', () => {
    const winter = [day('2018-01-15', 20, { kc: null })];
    const now = waterNow({ cropId: 'winter_wheat', date: '2018-01-15', days: winter, forecast: null });

    expect(now).toEqual({
      growing: false,
      availablePct: 87,
      availableMm: 130,
      capacityMm: 150,
      rootDepthM: 1.5,
      basis: expect.stringContaining('poza sezonem'),
    });
  });

  it('bez symulacji do daty analizy (brak pogody) nie ma pola', () => {
    expect(waterNow({ cropId: 'winter_wheat', date: DATE, days: [], forecast: null })).toBeNull();
    expect(
      waterNow({ cropId: 'winter_wheat', date: DATE, days: [day('2018-06-14', 10)], forecast: null }),
    ).toBeNull();
  });
});

describe('daysToStress', () => {
  const base = {
    cropId: 'winter_wheat' as const,
    date: '2018-06-15',
    readilyAvailableMm: 82.5,
    meanEt0Mm: 4,
  };

  it('poza horyzontem albo po koncu sezonu uprawy = null', () => {
    expect(daysToStress({ ...base, depletionMm: 0, meanEt0Mm: 0.1 })).toBeNull();
    // pszenica konczy krzywa Kc 2 sierpnia - przy malym zuzyciu stres nie nadejdzie przed zbiorem
    expect(daysToStress({ ...base, date: '2018-07-25', depletionMm: 0, meanEt0Mm: 1 })).toBeNull();
  });

  it('luka w prognozie (ET0 null) liczy sie srednim zuzyciem', () => {
    const forecast = [{ date: '2018-06-16', precipMm: null, et0Mm: null, tMinC: null, tMaxC: null }];

    expect(daysToStress({ ...base, depletionMm: 60, forecast })).toBe(5);
  });
});

describe('pomocniki', () => {
  it('procent zapasu jest w 0-100, a TAW 0 daje 0', () => {
    expect(availablePctOf({ totalAvailableMm: 100, depletionMm: 25 })).toBe(75);
    expect(availablePctOf({ totalAvailableMm: 100, depletionMm: 120 })).toBe(0);
    expect(availablePctOf({ totalAvailableMm: 0, depletionMm: 0 })).toBe(0);
  });

  it('mediana i typowy procent z lat tla, takze 29 lutego', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(typicalAvailablePct([day('2019-02-28', 75)], '2020-02-29')).toEqual({ pct: 50, years: 1 });
  });
});
