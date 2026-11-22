import { describe, expect, it } from 'vitest';

import { DROUGHT_REPORT } from '../fixtures/drought-report';
import { FIELD_REPORT } from '../fixtures/field-report';
import { LOW_CONFIDENCE_REPORT } from '../fixtures/low-confidence-report';
import { SAMPLE_REPORT } from '../fixtures/sample-report';
import {
  byPriority,
  byWeight,
  calendarRows,
  currentPeriod,
  excessSeasons,
  rankSide,
  IUNG_PERIODS,
  isPastAnalysis,
  isSampleReport,
  needsSampleBanner,
  periodDroughtCount,
  periodMonths,
  reportSearch,
  sampleParts,
  sampleScope,
  sampleSources,
  scenarioSummary,
  seasonRows,
  stressSummary,
  soilWater,
  verdictCaveat,
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

  it('czesci przykladowe: z meta.sampleParts, bez pola przy sample = caly raport', () => {
    expect([...sampleParts(DROUGHT_REPORT)]).toEqual(['causes', 'zones', 'recommendations']);
    expect(sampleParts(SAMPLE_REPORT).size).toBe(5);

    const realSources = {
      ...DROUGHT_REPORT,
      sources: DROUGHT_REPORT.sources.map((source) => ({ ...source, sample: false })),
    };

    // zrodla prawdziwe, przykladowe tylko reguly - bez ogolnego banera
    expect(needsSampleBanner(realSources)).toBe(false);
    expect(needsSampleBanner(DROUGHT_REPORT)).toBe(true);
    expect(needsSampleBanner(SAMPLE_REPORT)).toBe(true);
  });

  it('biezacy sezon dopisany na koniec historii z dniami stresu do dnia analizy', () => {
    const rows = seasonRows(DROUGHT_REPORT);

    expect(rows).toHaveLength(11);
    expect(rows.at(-1)).toMatchObject({ year: 2018, current: true, stressDays: 31, droughtPeriods: 1 });
    expect(stressSummary(rows)).toEqual({ average: 34, max: 59, maxYear: 2008 });

    const winter = { ...DROUGHT_REPORT, meta: { ...DROUGHT_REPORT.meta, analysisDate: '2018-02-10' } };

    expect(seasonRows(winter).some((row) => row.current)).toBe(false);
  });

  it('scenariusze gleby: susza tylko na lzejszych', () => {
    expect(scenarioSummary(DROUGHT_REPORT.assessment.climaticBalance)).toEqual({
      kind: 'lighter',
      drought: [1, 2],
      ok: [3, 4],
    });
    expect(scenarioSummary(null)).toBeNull();
  });

  it('kalendarz z biezacym rokiem: jeden znany okres, kolumny po miesiacach konca okresu', () => {
    const current = currentPeriod(DROUGHT_REPORT);

    expect(current).toEqual({ year: 2018, periodNo: 3, status: 'drought', balanceMm: -188.4 });

    const rows = calendarRows(DROUGHT_REPORT.history.calendar, current);

    expect(rows.at(-1)?.current).toBe(true);
    expect(rows.at(-1)?.cells.filter(Boolean)).toHaveLength(1);
    expect(periodMonths().map((group) => group.periods.length)).toEqual([2, 3, 3, 3, 3]);
    expect(periodDroughtCount(DROUGHT_REPORT.history.calendar, 3)).toEqual({ drought: 0, years: 10 });
  });

  it('dzien z przeszlosci: raport policzony pozniej', () => {
    expect(isPastAnalysis(DROUGHT_REPORT)).toBe(true);
    expect(
      isPastAnalysis({
        ...DROUGHT_REPORT,
        meta: { ...DROUGHT_REPORT.meta, analysisDate: '2026-11-21', generatedAt: '2026-11-21T20:45:51.289Z' },
      }),
    ).toBe(false);
  });

  it('strefa obejmujaca cale pole to nie "czesc pola"', () => {
    expect(zoneOf(DROUGHT_REPORT, 'zone-1')).toBeNull();
  });

  it('zasieg danych przykladowych: jedna atrapa (teren) to nie caly raport', () => {
    expect(sampleScope(LOW_CONFIDENCE_REPORT)).toBe('some');
    expect(sampleScope(SAMPLE_REPORT)).toBe('all');

    const fakeMeteo = {
      ...LOW_CONFIDENCE_REPORT,
      sources: LOW_CONFIDENCE_REPORT.sources.map((source) =>
        source.id === 'meteo' ? { ...source, sample: true } : source,
      ),
    };

    expect(sampleScope(fakeMeteo)).toBe('all');
    expect(
      sampleScope({
        ...LOW_CONFIDENCE_REPORT,
        meta: { ...LOW_CONFIDENCE_REPORT.meta, sample: false },
        sources: LOW_CONFIDENCE_REPORT.sources.map((source) => ({ ...source, sample: false })),
      }),
    ).toBeNull();
  });

  it('zastrzezenie przy werdykcie: niska pewnosc + braki, nie przy sredniej i poza sezonem', () => {
    expect(verdictCaveat(LOW_CONFIDENCE_REPORT)?.reasons).toEqual([
      'soil_missing',
      'meteo_coarse_grid',
      'balance_estimated',
    ]);
    expect(
      verdictCaveat({
        ...LOW_CONFIDENCE_REPORT,
        assessment: { ...LOW_CONFIDENCE_REPORT.assessment, confidence: 'medium' },
      }),
    ).toBeNull();
    expect(
      verdictCaveat({
        ...LOW_CONFIDENCE_REPORT,
        assessment: { ...LOW_CONFIDENCE_REPORT.assessment, level: 'out_of_season' },
      }),
    ).toBeNull();
  });

  it('kalendarz: wiersz roku analizy z okresow juz zakonczonych i okresu z oceny; nadmiar liczony po sezonach', () => {
    const rows = calendarRows(
      [
        { year: 2017, periodNo: 13, status: 'ok', balanceMm: 97, excess: true },
        { year: 2017, periodNo: 14, status: 'ok', balanceMm: 66, excess: true },
        { year: 2016, periodNo: 1, status: 'drought', balanceMm: -150 },
      ],
      { year: 2018, periodNo: 3, status: 'drought', balanceMm: -120 },
      [
        { year: 2018, periodNo: 1, status: 'ok', balanceMm: -40 },
        { year: 2018, periodNo: 2, status: 'ok', balanceMm: -80 },
      ],
    );
    const current = rows.at(-1);

    expect(current?.current).toBe(true);
    expect(current?.cells.slice(0, 4).map((cell) => cell?.status ?? null)).toEqual([
      'ok',
      'ok',
      'drought',
      null,
    ]);
    expect(
      excessSeasons([
        { year: 2017, periodNo: 13, status: 'ok', balanceMm: 97, excess: true },
        { year: 2017, periodNo: 14, status: 'ok', balanceMm: 66, excess: true },
        { year: 2011, periodNo: 9, status: 'not_monitored', balanceMm: 61, excess: true },
        { year: 2012, periodNo: 9, status: 'ok', balanceMm: 10 },
      ]),
    ).toBe(2);
  });

  it('miejsce na tle lat: w gornej polowie liczone od najbardziej mokrego', () => {
    expect(rankSide(1, 10)).toEqual({ side: 'dry', rank: 1, wet: 10 });
    expect(rankSide(5, 10).side).toBe('dry');
    expect(rankSide(11, 11)).toEqual({ side: 'wet', rank: 11, wet: 1 });
    expect(rankSide(1, 1).side).toBe('dry');
  });
});

describe('parametry raportu z zapisu', () => {
  it('cala dzialka: dzialki, uprawa i dzien analizy', () => {
    expect(reportSearch(FIELD_REPORT)).toEqual({
      dzialki: '080904_5.0001.349/1',
      uprawa: 'winter_wheat',
      data: '2018-06-15',
    });
  });

  it('narysowane pole: obrys w zwartym zapisie i rodzaj', () => {
    const search = reportSearch({ ...FIELD_REPORT, field: { ...FIELD_REPORT.field, kind: 'drawn' } });

    expect(search.rodzaj).toBe('drawn');
    expect(search.obszar).toMatch(/^[\w-]+$/);
  });
});
