import { describe, expect, it } from 'vitest';

import { SAMPLE_REPORT } from '../fixtures/sample-report';
import {
  byPriority,
  byWeight,
  calendarRows,
  IUNG_PERIODS,
  isSampleReport,
  sampleSources,
  soilWater,
  volumeM3,
  zoneOf,
} from './report-data';

describe('wyliczenia raportu', () => {
  it('zapas wody po ludzku: procent pelnego zapasu i litry na m2', () => {
    expect(
      soilWater({
        totalAvailableMm: 135,
        readilyAvailableMm: 74,
        depletionMm: 87.8,
        depletionShare: 0.65,
        stressCoefficient: 0.78,
        stressDays30: 5,
      }),
    ).toEqual({ percent: 35, leftMm: 47, totalMm: 135 });
  });

  it('1 mm na 1 ha to 10 m3', () => {
    expect(volumeM3(25, 4.62)).toBe(1155);
  });

  it('zalecenia od priorytetu 1, przyczyny od najwiekszego wplywu', () => {
    expect(byPriority(SAMPLE_REPORT.recommendations.agrotech).map((item) => item.priority)).toEqual([
      1, 2, 2,
    ]);
    expect(byWeight(SAMPLE_REPORT.causes).map((cause) => cause.id)).toEqual([
      'low_soil_retention',
      'surface_runoff',
      'precipitation_deficit',
    ]);
  });

  it('dane przykladowe: z meta albo z ktoregokolwiek zrodla', () => {
    const real = {
      ...SAMPLE_REPORT,
      meta: { ...SAMPLE_REPORT.meta, sample: false },
      sources: SAMPLE_REPORT.sources.map((source) => ({ ...source, sample: false })),
    };

    expect(isSampleReport(SAMPLE_REPORT)).toBe(true);
    expect(isSampleReport(real)).toBe(false);
    expect(isSampleReport({ ...real, sources: SAMPLE_REPORT.sources })).toBe(true);
    expect(sampleSources(SAMPLE_REPORT).map((source) => source.id)).not.toContain('parcel');
  });

  it('kalendarz: wiersze lat rosnaco, 14 okresow, braki jako null', () => {
    const rows = calendarRows([
      { year: 2021, periodNo: 2, status: 'drought', balanceMm: -180 },
      { year: 2019, periodNo: 1, status: 'ok', balanceMm: -20 },
    ]);

    expect(rows.map((row) => row.year)).toEqual([2019, 2021]);
    expect(rows[0]?.cells).toHaveLength(IUNG_PERIODS);
    expect(rows[1]?.cells[1]?.status).toBe('drought');
    expect(rows[1]?.cells[0]).toBeNull();
  });

  it('strefa zalecenia: po id, null dla calego pola', () => {
    expect(zoneOf(SAMPLE_REPORT, 'zone-2')?.kind).toBe('depression');
    expect(zoneOf(SAMPLE_REPORT, null)).toBeNull();
    expect(zoneOf({ ...SAMPLE_REPORT, zones: null }, 'zone-2')).toBeNull();
  });
});
