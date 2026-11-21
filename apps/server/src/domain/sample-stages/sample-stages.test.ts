import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { MeteoSeries, SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { addDays } from '../iso-date';
import { sampleStages } from './sample-stages';

const FIELD: FieldArea = {
  id: 'area:test',
  kind: 'drawn',
  parcelIds: [],
  label: '',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [17.9, 53.05],
  bbox: [17.9, 53.05, 17.903735, 53.051797],
  areaHa: 5,
};

const SOIL: SoilProfile = {
  sandPct: 60,
  siltPct: 25,
  clayPct: 15,
  organicMatterPct: 2,
  fieldCapacity: 0.208,
  wiltingPoint: 0.105,
  availableWaterMmPerM: 103,
  category: 2,
  basis: 'texture',
};

/** Stala pogoda: codziennie tyle samo opadu i parowania - wynik da sie policzyc w glowie. */
function steadyWeather(to: string, days: number, precipMm: number, et0Mm: number): MeteoSeries {
  return {
    gridKm: 50,
    days: Array.from({ length: days }, (_unused, index) => ({
      date: addDays(to, index - days + 1),
      precipMm,
      tMinC: 10,
      tMaxC: 22,
      tMeanC: 16,
      et0Mm,
    })),
  };
}

function input(date: string, meteo: MeteoSeries | null, overrides: Partial<StageInput> = {}): StageInput {
  return {
    field: FIELD,
    cropId: 'maize_grain',
    date,
    crop: sampleStages.crop('maize_grain', date),
    meteo,
    forecast: null,
    soil: SOIL,
    terrain: null,
    hydro: null,
    vegetation: null,
    ...overrides,
  };
}

describe('przykladowe etapy silnika', () => {
  it('bilans klimatyczny to opad minus parowanie w okresie IUNG konczacym sie do daty analizy', () => {
    // okres 7: 21 maja - 20 lipca = 61 dni; 1 mm opadu i 4 mm parowania dziennie
    const assessment = sampleStages.assess(input('2026-07-20', steadyWeather('2026-07-20', 400, 1, 4)));

    expect(assessment.climaticBalance).toMatchObject({
      status: 'ok',
      periodNo: 7,
      periodFrom: '2026-05-21',
      precipMm: 61,
      evapotranspirationMm: 244,
      balanceMm: -183,
      soilCategory: 2,
      belowThreshold: true,
    });
    expect(assessment.level).toBe('drought');
  });

  it('przy opadzie pokrywajacym parowanie nie ma niedoboru ani przyczyn', () => {
    const stage = input('2026-07-20', steadyWeather('2026-07-20', 400, 4, 3));
    const assessment = sampleStages.assess(stage);

    expect(assessment.rootZone).toMatchObject({ depletionMm: 0, stressCoefficient: 1, stressDays30: 0 });
    expect(['ok', 'excess']).toContain(assessment.level);
    expect(sampleStages.causes(stage, assessment)).toEqual([]);
  });

  it('zalecenia wynikaja z przyczyn, a nawadnianie tylko z bilansu strefy korzeniowej', () => {
    const stage = input('2026-07-20', steadyWeather('2026-07-20', 400, 0.5, 5));
    const assessment = sampleStages.assess(stage);
    const causes = sampleStages.causes(stage, assessment);
    const zones = sampleStages.zones(stage);
    const recommendations = sampleStages.recommend(stage, assessment, causes, zones);
    const all = [...recommendations.retention, ...recommendations.agrotech];

    expect(causes.map((cause) => cause.id)).toContain('low_soil_retention');
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((item) => item.causes.length > 0 && item.evidence.length > 0)).toBe(true);
    expect(recommendations.irrigation?.advisable).not.toBe('no');
    // brak danych przestrzennych = brak stref
    expect(zones).toBeNull();
  });

  it('bez pogody nie ocenia, bez gleby nie liczy bilansu strefy korzeniowej', () => {
    const none = sampleStages.assess(input('2026-07-20', null));
    const noSoil = sampleStages.assess(
      input('2026-07-20', steadyWeather('2026-07-20', 400, 1, 4), { soil: null }),
    );

    expect(none).toMatchObject({
      level: 'unknown',
      climaticBalance: null,
      rootZone: null,
      confidence: 'low',
    });
    expect(noSoil.rootZone).toBeNull();
    expect(noSoil.climaticBalance).toMatchObject({ thresholdMm: null, belowThreshold: null });
  });

  it('historia ma 10 sezonow po 14 okresow i oznacza braki danych', () => {
    const history = sampleStages.history(input('2026-07-20', steadyWeather('2026-07-20', 500, 1, 4)));

    expect(history.seasons.map((season) => season.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(history.calendar).toHaveLength(140);
    // pogoda siega do marca 2025: tylko ostatni sezon ma dane
    expect(history.seasonsWithData).toBe(1);
    expect(
      history.calendar.filter((item) => item.year === 2016).every((item) => item.status === 'missing'),
    ).toBe(true);
    expect(history.droughtSeasons).toBe(1);
  });
});
