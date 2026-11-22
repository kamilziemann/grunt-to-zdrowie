import { describe, expect, it } from 'vitest';

import type { DailyWeather } from '../analysis-ports';
import { addDays } from '../iso-date';
import { simulateRootZone } from '../root-zone-balance';
import { dailyWaterSeries } from './daily-water-series';

describe('dailyWaterSeries', () => {
  const weather: DailyWeather[] = Array.from({ length: 100 }, (_unused, index) => ({
    date: addDays('2022-04-01', index),
    // co piaty dzien luka w opadzie
    precipMm: index % 5 === 0 ? null : 2,
    tMinC: 10,
    tMaxC: 24,
    tMeanC: 17,
    et0Mm: 4,
  }));
  const { days } = simulateRootZone(weather, {
    cropId: 'maize_grain',
    availableWaterMmPerM: 120,
    latitude: 52,
    elevationM: 100,
  });

  it('ostatnie 60 dni do daty analizy, bez dni pozniejszych', () => {
    const series = dailyWaterSeries(days, '2022-06-30');

    expect(series).toHaveLength(60);
    expect(series.at(0)?.date).toBe('2022-05-02');
    expect(series.at(-1)?.date).toBe('2022-06-30');
  });

  it('luka w pogodzie = brak opadu w dniu; potrzeby, zuzycie i zapas zawsze sa', () => {
    const series = dailyWaterSeries(days, '2022-06-30');
    const gap = series.find((day) => day.date === '2022-06-25');
    const regular = series.find((day) => day.date === '2022-06-26');

    expect(gap).not.toHaveProperty('precipitationMm');
    expect(regular).toMatchObject({ precipitationMm: 2, etcMm: expect.any(Number) });
    expect(series.every((day) => day.availablePct >= 0 && day.availablePct <= 100)).toBe(true);
    expect(series.every((day) => (day.etaMm ?? 0) <= day.etcMm + 0.05)).toBe(true);
  });
});
