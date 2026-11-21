import { describe, expect, it } from 'vitest';

import type { DailyWeather } from '../analysis-ports';
import { addDays } from '../iso-date';
import { rootZoneStep, seasonStress, simulateRootZone } from './root-zone-balance';

describe('rootZoneStep - FAO-56, przyklad 37 (pomidor, gleba pylasta, 10 dni bez opadu)', () => {
  // TAW = 1000 (0,32 - 0,12) 0,8 = 160 mm, p = 0,40 -> RAW = 64 mm; Dr na starcie 55 mm, ET0 5 mm/d, Kc 1,2
  const PUBLISHED = [
    { ks: 1, etc: 6, end: 61 },
    { ks: 1, etc: 6, end: 67 },
    { ks: 0.97, etc: 5.8, end: 72.8 },
    { ks: 0.91, etc: 5.4, end: 78.3 },
    { ks: 0.85, etc: 5.1, end: 83.4 },
    { ks: 0.8, etc: 4.8, end: 88.2 },
    { ks: 0.75, etc: 4.5, end: 92.6 },
    { ks: 0.7, etc: 4.2, end: 96.9 },
    { ks: 0.66, etc: 3.9, end: 100.8 },
    { ks: 0.62, etc: 3.7, end: 104.5 },
  ];

  it('odtwarza Ks, ETc adj i Dr z tabeli publikacji', () => {
    let depletionMm = 55;

    const rows = PUBLISHED.map(() => {
      const step = rootZoneStep({
        depletionMm,
        precipMm: 0,
        potentialEtcMm: 6,
        totalAvailableMm: 160,
        depletionFraction: 0.4,
      });

      depletionMm = step.depletionMm;

      return step;
    });

    rows.forEach((row, index) => {
      const published = PUBLISHED[index];

      expect(row.stressCoefficient).toBeCloseTo(published?.ks ?? Number.NaN, 2);
      expect(Math.abs(row.actualEtcMm - (published?.etc ?? Number.NaN))).toBeLessThanOrEqual(0.06);
      expect(Math.abs(row.depletionMm - (published?.end ?? Number.NaN))).toBeLessThanOrEqual(0.2);
    });
  });
});

describe('rootZoneStep - FAO-56, przyklad 38 (bilans dla danych z przykladu 35)', () => {
  // gleba thetaFC 0,23, thetaWP 0,10 -> TAW = 130 Zr; p = 0,6; korzenie 0,30 -> 0,35 m; opad i nawodnienie rano.
  // ET0 i ETc (Kc = Ks Kcb + Ke) dnia sa wziete z tabeli publikacji; Dr na koniec dnia publikacja podaje w pelnych mm.
  const DAYS = [
    { zr: 0.3, precip: 0, irrigation: 40, etc: 5.5, deepPercolation: 17, end: 5 },
    { zr: 0.31, precip: 0, irrigation: 0, etc: 6.1, deepPercolation: 0, end: 12 },
    { zr: 0.31, precip: 0, irrigation: 0, etc: 4, deepPercolation: 0, end: 16 },
    { zr: 0.32, precip: 0, irrigation: 0, etc: 2.9, deepPercolation: 0, end: 18 },
    { zr: 0.32, precip: 0, irrigation: 0, etc: 2.5, deepPercolation: 0, end: 21 },
    { zr: 0.33, precip: 6, irrigation: 0, etc: 2.7, deepPercolation: 0, end: 18 },
    { zr: 0.33, precip: 0, irrigation: 0, etc: 4.7, deepPercolation: 0, end: 22 },
    { zr: 0.34, precip: 0, irrigation: 0, etc: 2.8, deepPercolation: 0, end: 25 },
    { zr: 0.34, precip: 0, irrigation: 0, etc: 2.2, deepPercolation: 0, end: 27 },
    { zr: 0.35, precip: 0, irrigation: 27, etc: 6.3, deepPercolation: 0, end: 6 },
  ];

  it('daje wyczerpanie i odplyw w glab co do 1 mm, bez stresu (Ks = 1)', () => {
    let depletionMm = 23;
    const problems: string[] = [];

    for (const [index, day] of DAYS.entries()) {
      const step = rootZoneStep({
        depletionMm,
        precipMm: day.precip,
        irrigationMm: day.irrigation,
        potentialEtcMm: day.etc,
        totalAvailableMm: 130 * day.zr,
        depletionFraction: 0.6,
      });

      depletionMm = step.depletionMm;

      if (Math.abs(step.depletionMm - day.end) > 1) problems.push(`day ${index + 1}: Dr ${step.depletionMm}`);

      if (Math.abs(step.deepPercolationMm - day.deepPercolation) > 1) problems.push(`day ${index + 1}: DP`);

      if (step.stressCoefficient !== 1) problems.push(`day ${index + 1}: Ks ${step.stressCoefficient}`);
    }

    expect(problems).toEqual([]);
  });
});

describe('simulateRootZone', () => {
  const weather = (from: string, length: number, day: Partial<DailyWeather>): DailyWeather[] =>
    Array.from({ length }, (_unused, index) => ({
      date: addDays(from, index),
      precipMm: 0,
      tMinC: 14,
      tMaxC: 28,
      tMeanC: 21,
      et0Mm: 5,
      ...day,
    }));

  it('susza w sezonie: wyczerpanie rosnie do TAW, Ks spada, dni stresu i niedobor ET sa liczone', () => {
    const simulation = simulateRootZone(weather('2018-05-01', 92, {}), {
      cropId: 'maize_grain',
      availableWaterMmPerM: 100,
      latitude: 52,
      elevationM: 100,
    });
    const last = simulation.days.at(-1);
    const stress = seasonStress(simulation.days, '2018-05-01', '2018-07-31');

    expect(last?.depletionMm).toBeGreaterThan(last?.readilyAvailableMm ?? Number.POSITIVE_INFINITY);
    expect(last?.depletionMm).toBeLessThanOrEqual(last?.totalAvailableMm ?? 0);
    expect(last?.stressCoefficient).toBeLessThan(0.5);
    expect(stress.stressDays).toBeGreaterThan(20);
    expect(stress.etDeficitMm).toBeGreaterThan(50);
    expect(simulation.gapDays).toBe(0);
  });

  it('obfity deszcz trzyma profil przy pojemnosci polowej, a luki w serii sa liczone', () => {
    const wet = weather('2021-05-01', 92, { precipMm: 8 });

    wet[10] = {
      ...wet[10],
      date: '2021-05-11',
      precipMm: null,
      tMinC: null,
      tMaxC: null,
      tMeanC: null,
      et0Mm: null,
    };

    const simulation = simulateRootZone(wet, {
      cropId: 'maize_grain',
      availableWaterMmPerM: 100,
      latitude: 52,
      elevationM: 100,
    });

    expect(Math.max(...simulation.days.map((day) => day.depletionMm))).toBeLessThanOrEqual(8);
    expect(seasonStress(simulation.days, '2021-05-01', '2021-07-31').stressDays).toBe(0);
    expect(simulation.gapDays).toBe(1);
  });
});
