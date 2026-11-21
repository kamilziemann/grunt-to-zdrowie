import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { createSampleSources } from './sample-sources';

const FIELD: FieldArea = {
  id: 'area:test',
  kind: 'drawn',
  parcelIds: [],
  label: '',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [17.9, 53.05],
  bbox: [17.898, 53.049, 17.902, 53.051],
  areaHa: 5,
};

describe('dane przykladowe', () => {
  const sources = createSampleSources();

  it('pogoda jest powtarzalna, ciagla i oznaczona jako przykladowa', async () => {
    const first = await sources.meteo.series([17.9, 53.05], '2026-05-01', '2026-06-30');
    const second = await sources.meteo.series([17.9, 53.05], '2026-06-01', '2026-06-30');

    expect(first.source).toMatchObject({ id: 'meteo', sample: true, status: 'ok' });
    expect(first.data?.days).toHaveLength(61);
    expect(first.data?.days.at(-1)).toEqual(second.data?.days.at(-1));
    expect(first.data?.days.every((day) => (day.precipMm ?? -1) >= 0 && (day.et0Mm ?? -1) > 0)).toBe(true);
  });

  it('inne miejsce daje inna pogode, lato paruje mocniej niz zima', async () => {
    const here = await sources.meteo.series([17.9, 53.05], '2026-01-01', '2026-12-31');
    const there = await sources.meteo.series([21.59, 52.17], '2026-01-01', '2026-12-31');
    const et0 = (from: number, to: number) =>
      (here.data?.days ?? []).slice(from, to).reduce((sum, day) => sum + (day.et0Mm ?? 0), 0);

    expect(here.data?.days.map((day) => day.precipMm)).not.toEqual(
      there.data?.days.map((day) => day.precipMm),
    );
    expect(et0(170, 200)).toBeGreaterThan(et0(0, 30) * 3);
  });

  it('kazde zrodlo oddaje dane dla pola, a satelita nie ma archiwum sprzed 2017', async () => {
    const [soil, terrain, hydro, vegetation, old] = await Promise.all([
      sources.soil.profile(FIELD),
      sources.terrain.terrain(FIELD),
      sources.hydro.context(FIELD),
      sources.vegetation.series(FIELD, '2026-06-30'),
      sources.vegetation.series(FIELD, '2016-06-30'),
    ]);

    expect(soil.data?.availableWaterMmPerM).toBeGreaterThan(50);
    expect(terrain.data?.grid.elevationM).toHaveLength(400);
    expect(hydro.data?.nearestDitchM).toBeGreaterThan(0);
    expect(vegetation.data?.observations).toHaveLength(3);
    expect(vegetation.data?.baseline.map((item) => item.year)).toEqual([2025, 2024, 2023, 2022, 2021]);
    expect(old).toMatchObject({ data: null, source: { status: 'missing', sample: true } });
  });
});
