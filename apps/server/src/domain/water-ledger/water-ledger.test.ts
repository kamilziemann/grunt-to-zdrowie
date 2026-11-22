import { describe, expect, it } from 'vitest';

import type { DailyWeather } from '../analysis-ports';
import { addDays, daysBetween } from '../iso-date';
import { simulateRootZone, type RootZoneDay } from '../root-zone-balance';
import { waterLedger } from './water-ledger';

function day(date: string, values: Partial<RootZoneDay>): RootZoneDay {
  return {
    date,
    kc: 1,
    rootDepthM: 1,
    et0Mm: 4,
    totalAvailableMm: 100,
    readilyAvailableMm: 55,
    depletionMm: 0,
    stressCoefficient: 1,
    potentialEtcMm: 4,
    actualEtcMm: 4,
    precipMm: 0,
    startDepletionMm: 0,
    deepPercolationMm: 0,
    ...values,
  };
}

const balanced = (ledger: NonNullable<ReturnType<typeof waterLedger>>): number =>
  Number(
    (
      ledger.startStorageMm +
      ledger.precipitationMm -
      ledger.cropUseMm -
      ledger.lostBelowRootsMm -
      ledger.endStorageMm
    ).toFixed(3),
  ) + 0;

describe('waterLedger - przeliczone recznie', () => {
  // TAW 100. 20.03: Dr 10 -> zapas na starcie 90 mm.
  // 21.03: deszcz 5 -> Dr 5, zuzycie 3 -> Dr 8. 22.03: deszcz 20 -> Dr 0, 12 mm przesiaka, zuzycie 4 (z potrzeb 6) -> Dr 4.
  // Rachunek: 90 + 25 - 7 - 12 = 96 = 100 - 4; niedobor 6 - 4 = 2 mm.
  const days = [
    day('2024-03-20', { depletionMm: 10 }),
    day('2024-03-21', {
      precipMm: 5,
      startDepletionMm: 5,
      depletionMm: 8,
      actualEtcMm: 3,
      potentialEtcMm: 3,
    }),
    day('2024-03-22', {
      precipMm: 20,
      startDepletionMm: 0,
      deepPercolationMm: 12,
      depletionMm: 4,
      actualEtcMm: 4,
      potentialEtcMm: 6,
    }),
  ];

  it('zapas + opad - zuzycie - przesiakanie = zapas na koniec', () => {
    const ledger = waterLedger(days, '2024-03-22');

    expect(ledger).toEqual({
      from: '2024-03-21',
      to: '2024-03-22',
      startStorageMm: 90,
      precipitationMm: 25,
      cropUseMm: 7,
      lostBelowRootsMm: 12,
      endStorageMm: 96,
      shortfallMm: 2,
    });
  });

  it('przed 21 marca albo bez dnia przed startem nie ma rachunku', () => {
    expect(waterLedger(days, '2024-03-10')).toBeNull();
    expect(waterLedger(days.slice(1), '2024-03-22')).toBeNull();
  });

  it('luki w pogodzie sa policzone i opisane', () => {
    const gap = [...days.slice(0, 2), { ...days[2], precipMm: null, deepPercolationMm: 0 } as RootZoneDay];

    expect(waterLedger(gap, '2024-03-22')).toMatchObject({ precipitationMm: 5, missingWeatherDays: 1 });
  });
});

describe('waterLedger - na symulacji bilansu', () => {
  const weather = (from: string, to: string, pattern: (date: string) => Partial<DailyWeather>) =>
    Array.from({ length: daysBetween(from, to) + 1 }, (_unused, index) => {
      const date = addDays(from, index);

      return {
        date,
        precipMm: 1,
        tMinC: 8,
        tMaxC: 22,
        tMeanC: 15,
        et0Mm: 3.5,
        ...pattern(date),
      } satisfies DailyWeather;
    });
  const options = { availableWaterMmPerM: 110, latitude: 52, elevationM: 100 } as const;
  const sumOver = (
    days: readonly RootZoneDay[],
    from: string,
    to: string,
    pick: (day: RootZoneDay) => number,
  ) => days.filter((item) => item.date >= from && item.date <= to).reduce((sum, item) => sum + pick(item), 0);

  it('susza, potem ulewy: rachunek sie domyka, zuzycie = suma ETc adj, woda przesiaka, roslinom brakowalo', () => {
    // jeczmien jary: korzenie rosna od 0,6 do 1,2 m; sucho od 15 kwietnia do 10 czerwca, potem 25 mm co 2 dni
    const series = weather('2023-01-01', '2023-06-30', (date) =>
      date >= '2023-04-15' && date < '2023-06-10'
        ? { precipMm: 0, et0Mm: 5 }
        : date >= '2023-06-10'
          ? { precipMm: Number(date.slice(8)) % 2 === 0 ? 25 : 0 }
          : {},
    );
    const { days } = simulateRootZone(series, { cropId: 'spring_barley', ...options });
    const ledger = waterLedger(days, '2023-06-30');

    if (!ledger) throw new Error('brak rachunku');

    expect(balanced(ledger)).toBe(0);
    expect(
      Math.abs(ledger.cropUseMm - sumOver(days, ledger.from, ledger.to, (item) => item.actualEtcMm)),
    ).toBeLessThanOrEqual(0.2);
    expect(ledger.lostBelowRootsMm).toBeGreaterThan(0);
    expect(ledger.shortfallMm).toBeGreaterThan(20);
    // zapas na koniec = TAW - Dr w dniu analizy
    const last = days.find((item) => item.date === '2023-06-30');

    expect(ledger.endStorageMm).toBeCloseTo((last?.totalAvailableMm ?? 0) - (last?.depletionMm ?? 0), 1);
  });

  it('po zbiorze uprawy jarej rachunek konczy sie w ostatnim dniu przed skurczeniem strefy korzeni', () => {
    const series = weather('2023-01-01', '2023-09-15', () => ({}));
    const { days } = simulateRootZone(series, { cropId: 'spring_barley', ...options });
    const ledger = waterLedger(days, '2023-09-15');

    // krzywa Kc jeczmienia: 1 kwietnia + 120 dni = 30 lipca
    expect(ledger?.to).toBe('2023-07-30');
    expect(ledger ? balanced(ledger) : null).toBe(0);
  });
});
