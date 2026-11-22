import type { SourceRef } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { forecastReport } from './forecast-report';

const SOURCE: SourceRef = {
  id: 'forecast',
  provider: 'MET Norway Locationforecast 2.0 (ECMWF)',
  status: 'ok',
  sample: false,
  fetchedAt: '2026-11-22T08:00:00.000Z',
};

describe('forecastReport', () => {
  it('dni prognozy z data wydania; brakujace wartosci pomija', () => {
    const report = forecastReport(
      {
        issuedAt: '2026-11-22T06:10:00Z',
        days: [
          { date: '2026-11-23', precipMm: 2.4, et0Mm: 0.5, tMinC: -1, tMaxC: 4 },
          { date: '2026-11-24', precipMm: null, et0Mm: null, tMinC: null, tMaxC: 3 },
        ],
      },
      SOURCE,
    );

    expect(report).toEqual({
      days: [
        { date: '2026-11-23', precipitationMm: 2.4, et0Mm: 0.5, tMinC: -1, tMaxC: 4 },
        { date: '2026-11-24', tMaxC: 3 },
      ],
      source: 'MET Norway Locationforecast 2.0 (ECMWF)',
      issuedAt: '2026-11-22T06:10:00Z',
    });
  });

  it('bez daty wydania - chwila pobrania; bez prognozy (data historyczna) - brak pola', () => {
    const day = { date: '2026-11-23', precipMm: 0, et0Mm: 0.4, tMinC: 0, tMaxC: 5 };

    expect(forecastReport({ days: [day] }, SOURCE)?.issuedAt).toBe('2026-11-22T08:00:00.000Z');
    expect(forecastReport(null, null)).toBeNull();
    expect(forecastReport({ days: [] }, SOURCE)).toBeNull();
  });
});
