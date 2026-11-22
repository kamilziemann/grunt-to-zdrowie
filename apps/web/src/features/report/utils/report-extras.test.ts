import { describe, expect, it } from 'vitest';

import { AUTUMN_REPORT } from '../fixtures/autumn-report';
import { HEAT_REPORT } from '../fixtures/heat-report';
import { WEATHER_REPORT } from '../fixtures/weather-report';
import { causeShare, reportExtras, sourceMode, waterTank } from './report-extras';

describe('reportExtras', () => {
  it('czyta pola 0.8.0, a zepsute albo puste pole to undefined (stary raport z zapisu)', () => {
    expect(reportExtras(WEATHER_REPORT).waterNow?.availablePct).toBe(4);
    expect(reportExtras(WEATHER_REPORT).forecast).toBeUndefined();
    expect(reportExtras(AUTUMN_REPORT).forecast?.days).toHaveLength(7);
    expect(reportExtras(HEAT_REPORT)).toEqual({
      waterNow: undefined,
      forecast: undefined,
      waterLedger: undefined,
      dailySeries: undefined,
      vegetationSeries: undefined,
    });
    expect(
      reportExtras({ ...HEAT_REPORT, waterNow: { availablePct: 'duzo' } } as never).waterNow,
    ).toBeUndefined();
  });
});

describe('waterTank', () => {
  it('z waterNow: prog stresu tylko w sezonie uprawy', () => {
    expect(waterTank(WEATHER_REPORT)).toMatchObject({ availablePct: 4, stressBelowPct: 45, typicalPct: 24 });
    expect(waterTank(AUTUMN_REPORT)).toMatchObject({
      availablePct: 99,
      growing: false,
      stressBelowPct: undefined,
    });
  });

  it('stary raport: zapas i prog z bilansu strefy korzeni (TAW, RAW, wyczerpanie)', () => {
    // TAW 118,4, RAW 65,1, wyczerpanie 113,7 -> 4% zapasu, prog (118,4 - 65,1) / 118,4 = 45%
    expect(waterTank(HEAT_REPORT)).toMatchObject({ availablePct: 4, stressBelowPct: 45, growing: true });
  });
});

describe('causeShare i sourceMode', () => {
  it('udzial z silnika, a bez niego waga / suma wag', () => {
    const [first] = WEATHER_REPORT.causes;

    expect(first && causeShare(first, WEATHER_REPORT.causes)).toBe(0.308);

    const old = HEAT_REPORT.causes;
    const total = old.reduce((sum, cause) => sum + cause.weight, 0);

    expect(old[0] && causeShare(old[0], old)).toBeCloseTo((old[0]?.weight ?? 0) / total);
  });

  it('tryb zrodla: na biezaco albo wczesniej; brak w starym raporcie', () => {
    expect(WEATHER_REPORT.sources.map(sourceMode)).toContain('preloaded');
    expect(HEAT_REPORT.sources.map(sourceMode).every((mode) => mode === undefined)).toBe(true);
  });
});
