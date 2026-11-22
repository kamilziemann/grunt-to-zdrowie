import type { Recommendation } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { AUTUMN_REPORT } from '../fixtures/autumn-report';
import { WEATHER_REPORT } from '../fixtures/weather-report';
import {
  drySeasons,
  forecastSummary,
  lastSummerDate,
  orderedRecommendations,
  rainUseSummary,
  riskMonthRange,
  scaleStep,
  stepBadge,
  vegetationSummary,
} from './report-summary';

const BASE: Recommendation = {
  measure: 'cover_crop',
  category: 'agrotech',
  priority: 1,
  causes: ['low_soil_retention'],
  evidence: [{ metric: 'slope_mean_pct', value: 1, unit: '%', source: 'terrain' }],
  zoneId: null,
  effect: null,
  effort: 'low',
  legal: 'none',
};

describe('report-summary', () => {
  it('skala: od mokro do bardzo sucho; poza sezonem bez miejsca na skali', () => {
    expect(scaleStep('excess')).toBe('wet');
    expect(scaleStep('drought')).toBe('veryDry');
    expect(scaleStep('out_of_season')).toBeNull();
  });

  it('sucho w N z 10 i zakres miesiecy ryzyka', () => {
    expect(drySeasons(WEATHER_REPORT)).toEqual({ dry: 9, total: 10 });
    expect(riskMonthRange([6, 5])).toEqual([5, 6]);
    expect(riskMonthRange([])).toBeNull();
  });

  it('plakietka pierwszego kroku tylko z formalnosci, nakladu i dopiskow serwera', () => {
    expect(stepBadge(BASE)).toBe('now');
    expect(stepBadge({ ...BASE, effort: 'medium' })).toBeNull();
    expect(stepBadge({ ...BASE, legal: 'permit' })).toBe('permit');
    expect(stepBadge({ ...BASE, notes: [{ id: 'piped_junction', text: 'x' }] })).toBe('check');
    expect(stepBadge({ ...BASE, notes: [{ id: 'protected_area', text: 'x' }] })).toBe('protected');
  });

  it('kolejnosc zalecen: zatrzymaj wode, potem gleba; przy nadmiarze bez retencji', () => {
    expect(orderedRecommendations(WEATHER_REPORT)[0]?.category).toBe('retention');
    expect(
      orderedRecommendations({
        ...WEATHER_REPORT,
        assessment: { ...WEATHER_REPORT.assessment, level: 'excess' },
      })[0]?.category,
    ).toBe('agrotech');
  });

  it('prognoza, deszcz i zuzycie, satelita', () => {
    const summary = forecastSummary([
      { date: '2026-11-23', precipitationMm: 0.6 },
      { date: '2026-11-24', precipitationMm: 6.3 },
      { date: '2026-11-25' },
    ]);

    expect(summary.totalMm).toBeCloseTo(6.9);
    expect(summary.wettest?.date).toBe('2026-11-24');
    expect(summary.rainyDays).toBe(1);
    expect(
      rainUseSummary([
        { date: '2019-06-28', precipitationMm: 3, etcMm: 5, availablePct: 10 },
        { date: '2019-06-29', precipitationMm: 0, etcMm: 6, availablePct: 8 },
        { date: '2019-06-30', etcMm: 7, availablePct: 4 },
      ]),
    ).toEqual({ rainMm: 3, useMm: 18, days: 3, dryStreak: 2 });

    const vegetation = vegetationSummary(WEATHER_REPORT.vegetationSeries?.observations ?? []);

    expect(vegetation.skipped).toBe(4);
    expect(vegetation.latest?.used).toBe(true);
  });

  it('poza sezonem: 15 czerwca ostatniego sezonu (jesien - ten rok, przedwiosnie - poprzedni)', () => {
    expect(lastSummerDate(AUTUMN_REPORT)).toBe('2026-06-15');
    expect(
      lastSummerDate({ ...AUTUMN_REPORT, meta: { ...AUTUMN_REPORT.meta, analysisDate: '2026-02-10' } }),
    ).toBe('2025-06-15');
    expect(lastSummerDate(WEATHER_REPORT)).toBeNull();
  });
});
