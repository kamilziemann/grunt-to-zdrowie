import { describe, expect, it } from 'vitest';

import type { VegetationSeries } from '../analysis-ports';
import { vegetationSeriesReport } from './vegetation-series';

const SERIES: VegetationSeries = {
  observations: [
    { date: '2023-06-18', ndvi: 0.71, ndmi: 0.21, validShare: 0.98, pixels: 400 },
    { date: '2023-06-03', ndvi: 0.75, ndmi: 0.26, validShare: 0.9, pixels: 380 },
  ],
  rejected: [{ date: '2023-06-10', ndvi: null, ndmi: null, validShare: 0, pixels: 0 }],
  baseline: [
    { date: '2022-06-19', year: 2022, ndvi: 0.78, ndmi: 0.3, validShare: 1, pixels: 400 },
    { date: '2021-06-22', year: 2021, ndvi: 0.7, ndmi: 0.24, validShare: 1, pixels: 400 },
    { date: '2020-06-15', year: 2020, ndvi: 0.74, ndmi: null, validShare: 1, pixels: 400 },
  ],
  cellSizeM: 10,
  window: { from: '2023-05-22', to: '2023-06-20' },
};

describe('vegetationSeriesReport', () => {
  it('sceny po dacie, pominiete przez chmury oznaczone, typowy zakres z lat poprzednich', () => {
    expect(vegetationSeriesReport(SERIES, '2023-06-20')).toEqual({
      from: '2023-05-22',
      to: '2023-06-20',
      observations: [
        { date: '2023-06-03', ndvi: 0.75, ndmi: 0.26, validShare: 0.9, used: true },
        { date: '2023-06-10', ndvi: null, ndmi: null, validShare: 0, used: false },
        { date: '2023-06-18', ndvi: 0.71, ndmi: 0.21, validShare: 0.98, used: true },
      ],
      baseline: {
        years: 3,
        ndvi: { min: 0.7, median: 0.74, max: 0.78 },
        ndmi: { min: 0.24, median: 0.27, max: 0.3 },
      },
    });
  });

  it('przed archiwum Sentinel-2 (2017) i bez zdjec - brak pola', () => {
    expect(vegetationSeriesReport(SERIES, '2016-06-20')).toBeNull();
    expect(vegetationSeriesReport(null, '2023-06-20')).toBeNull();
    expect(
      vegetationSeriesReport({ observations: [], baseline: [], cellSizeM: 10 }, '2023-06-20'),
    ).toBeNull();
  });

  it('starszy adapter bez okna i odrzuconych scen: okno 30 dni do daty', () => {
    const { rejected: _rejected, window: _window, ...older } = SERIES;

    expect(vegetationSeriesReport(older, '2023-06-20')).toMatchObject({
      from: '2023-05-22',
      to: '2023-06-20',
      observations: [{ used: true }, { used: true }],
    });
  });
});
