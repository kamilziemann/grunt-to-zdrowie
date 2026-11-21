import type { Assessment, Cause, FieldArea, RootZone } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { HydroContext, SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { saxtonRawls } from '../soil-water';
import { irrigationAdvice, organicMatterGainMm, recommend } from './recommendations';

const FIELD: FieldArea = {
  id: 'area:test',
  kind: 'drawn',
  parcelIds: [],
  label: '',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [19.05, 54.2],
  bbox: [19.05, 54.2, 19.053, 54.202],
  areaHa: 5,
};

const SOIL: SoilProfile = {
  sandPct: 80,
  siltPct: 12,
  clayPct: 8,
  organicMatterPct: 1.5,
  fieldCapacity: 0.15,
  wiltingPoint: 0.07,
  availableWaterMmPerM: 80,
  category: 2,
  basis: 'texture',
  modelled: true,
};

const HYDRO: HydroContext = {
  searchRadiusM: 500,
  nearestWatercourseM: null,
  nearestDitchM: 0,
  nearestWaterBodyM: null,
  nearestWetlandM: 120,
  waterBodies: 0,
  wetlands: 1,
  ditchesInRadius: 30,
  ditchLengthInFieldM: 250,
  features: [],
  treeCoverShare: null,
};

// koniec czerwca: pszenica ozima jeszcze w pelni rozwoju (Kc 1,15)
const DATE = '2021-06-28';

const input = (extra: Partial<StageInput> = {}): StageInput => ({
  field: FIELD,
  cropId: 'winter_wheat',
  date: DATE,
  crop: cropAtDate('winter_wheat', DATE),
  meteo: null,
  forecast: null,
  soil: SOIL,
  terrain: null,
  hydro: HYDRO,
  vegetation: null,
  ...extra,
});

const ZONE: RootZone = {
  totalAvailableMm: 100,
  readilyAvailableMm: 55,
  depletionMm: 80,
  depletionShare: 0.8,
  stressCoefficient: 0.44,
  stressDays30: 12,
};

const assessment = (level: Assessment['level'], rootZone: RootZone | null = ZONE): Assessment => ({
  level,
  confidence: 'medium',
  climaticBalance: null,
  rootZone,
  vegetation: null,
  precipitation: null,
});

const cause = (id: Cause['id'], weight: number, metric = id): Cause => ({
  id,
  weight,
  evidence: [{ metric, value: 1, unit: 'x', source: 'meteo' }],
});

const ALL: Cause[] = [
  cause('precipitation_deficit', 0.7),
  cause('high_evaporative_demand', 0.4),
  cause('low_soil_retention', 0.6),
  cause('fast_drainage', 0.5),
  cause('crop_sensitivity', 0.5),
];

describe('recommend', () => {
  it('retencja przed agrotechnika, kazde dzialanie z przyczyna z listy i jej dowodami', () => {
    const result = recommend(input(), assessment('drought'), ALL);
    const all = [...result.retention, ...result.agrotech];

    expect(result.retention.map((item) => item.measure)).toEqual([
      'ditch_weir',
      'protect_wetland',
      'field_margin_trees',
    ]);
    expect(result.agrotech.map((item) => item.measure)).toEqual([
      'mulch_residue',
      'organic_matter',
      'cover_crop',
      'reduced_tillage',
      'crop_choice',
    ]);
    expect(all.every((item) => item.causes.every((id) => ALL.some((found) => found.id === id)))).toBe(true);
    expect(all.every((item) => item.evidence.length > 0)).toBe(true);
    expect(result.retention.every((item) => item.category === 'retention')).toBe(true);
  });

  it('zastawka: objetosc z dlugosci rowu w polu (0,4 m3/m) i zgloszenie wodnoprawne; mokradlo z odlegloscia', () => {
    const result = recommend(input(), assessment('drought'), ALL);
    const weir = result.retention.find((item) => item.measure === 'ditch_weir');
    const wetland = result.retention.find((item) => item.measure === 'protect_wetland');

    expect(weir).toMatchObject({
      effect: { kind: 'volume_m3', value: 100 },
      legal: 'notification',
      causes: ['fast_drainage'],
    });
    expect(wetland?.evidence.at(-1)).toMatchObject({
      metric: 'nearest_wetland_m',
      value: 120,
      source: 'hydro',
    });
  });

  it('row tylko przy granicy: zastawka bez szacunku objetosci', () => {
    const result = recommend(
      input({ hydro: { ...HYDRO, ditchLengthInFieldM: 0, nearestDitchM: 30 } }),
      assessment('risk'),
      ALL,
    );

    expect(result.retention.find((item) => item.measure === 'ditch_weir')?.effect).toBeNull();
  });

  it('materia organiczna: efekt z Saxtona-Rawlsa dla +1 p.p. w warstwie 0-30 cm', () => {
    const before = saxtonRawls({ sandPct: 80, clayPct: 8, organicMatterPct: 1.5 }).availableWater;
    const after = saxtonRawls({ sandPct: 80, clayPct: 8, organicMatterPct: 2.5 }).availableWater;
    const gain = Number(((after - before) * 300).toFixed(1));
    const organic = recommend(input(), assessment('drought'), ALL).agrotech.find(
      (item) => item.measure === 'organic_matter',
    );

    expect(organicMatterGainMm(input())).toBe(gain);
    expect(gain).toBeGreaterThan(1);
    expect(gain).toBeLessThan(6);
    expect(organic?.effect).toEqual({ kind: 'water_mm', value: gain });
  });

  it('oczko wodne tylko poza glebami lekkimi (kat. I albo < 90 mm/m - woda wsiaka)', () => {
    const noWater = [cause('no_landscape_retention', 0.3)];
    const ponds = (soil: SoilProfile) =>
      recommend(input({ soil }), assessment('drought'), noWater).retention.some(
        (item) => item.measure === 'small_pond',
      );

    expect(ponds({ ...SOIL, category: 3, availableWaterMmPerM: 150 })).toBe(true);
    expect(ponds({ ...SOIL, category: 1, availableWaterMmPerM: 150 })).toBe(false);
    expect(ponds({ ...SOIL, category: 2, availableWaterMmPerM: 80 })).toBe(false);
  });

  it('bez przyczyn nie ma dzialan', () => {
    const result = recommend(input(), assessment('ok'), []);

    expect([result.retention, result.agrotech]).toEqual([[], []]);
  });
});

describe('irrigationAdvice', () => {
  it('silny stres w okresie wzrostu przy suszy: nawodnic dawka do polowej pojemnosci', () => {
    expect(irrigationAdvice(input(), assessment('drought'))).toEqual({
      advisable: 'yes',
      netDepthMm: 80,
      withinDays: 0,
      forecastPrecipMm: null,
    });
  });

  it('deszcz z prognozy pokrywajacy niedobor zastepuje nawodnienie', () => {
    const forecast = {
      days: Array.from({ length: 7 }, (_unused, index) => ({
        date: `2021-07-0${1 + index}`,
        precipMm: 15,
        et0Mm: 3,
        tMinC: 12,
        tMaxC: 22,
      })),
    };

    expect(irrigationAdvice(input({ forecast }), assessment('drought'))).toMatchObject({
      advisable: 'no',
      netDepthMm: null,
      forecastPrecipMm: 105,
    });
  });

  it('zapas jeszcze latwo dostepny, ale prognoza sucha: rozwazyc, gdy przekroczenie w 3 dni', () => {
    const forecast = {
      days: Array.from({ length: 7 }, (_unused, index) => ({
        date: `2021-07-0${1 + index}`,
        precipMm: 0,
        et0Mm: 6,
        tMinC: 16,
        tMaxC: 32,
      })),
    };
    const near = { ...ZONE, depletionMm: 50, stressCoefficient: 1 };

    expect(irrigationAdvice(input({ forecast }), assessment('watch', near))).toMatchObject({
      advisable: 'consider',
      // pszenica w pelni rozwoju (Kc 1,15): 50 + 6,9 mm > 55 mm RAW juz pierwszego dnia prognozy
      withinDays: 1,
      netDepthMm: 50,
    });
  });

  it('bez niedoboru, poza wzrostem albo w dojrzewaniu: nie nawadniac; bez oceny i bez bilansu: brak wskazowki', () => {
    const winter = input({ date: '2021-12-01', crop: cropAtDate('winter_wheat', '2021-12-01') });
    const ripening = input({ date: '2021-07-20', crop: cropAtDate('winter_wheat', '2021-07-20') });

    expect(ripening.crop.stage).toBe('late');
    expect(irrigationAdvice(ripening, assessment('drought'))?.advisable).toBe('no');

    expect(irrigationAdvice(input(), assessment('ok'))?.advisable).toBe('no');
    expect(irrigationAdvice(winter, assessment('drought'))?.advisable).toBe('no');
    expect(irrigationAdvice(input(), assessment('unknown'))).toBeNull();
    expect(irrigationAdvice(input(), assessment('drought', null))).toBeNull();
  });
});
