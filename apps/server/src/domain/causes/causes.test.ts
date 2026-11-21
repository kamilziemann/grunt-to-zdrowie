import type { Assessment, CropId, FieldArea, History } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { DailyWeather, HydroContext, MeteoSeries, SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { assess } from '../assessment';
import { cropAtDate } from '../crop-calendar';
import { history } from '../history';
import { addDays, addYears, daysBetween } from '../iso-date';
import { causes, recurrentDeficit } from './causes';

const FIELD: FieldArea = {
  id: 'area:test',
  kind: 'drawn',
  parcelIds: [],
  label: '',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [21.56, 52.17],
  bbox: [21.56, 52.17, 21.563, 52.172],
  areaHa: 5,
};

const LOAM: SoilProfile = {
  sandPct: 40,
  siltPct: 40,
  clayPct: 20,
  organicMatterPct: 2,
  fieldCapacity: 0.28,
  wiltingPoint: 0.137,
  availableWaterMmPerM: 160,
  category: 4,
  basis: 'texture',
  modelled: true,
};

const SAND: SoilProfile = {
  ...LOAM,
  sandPct: 82,
  siltPct: 12,
  clayPct: 6,
  availableWaterMmPerM: 75,
  category: 1,
};

const NO_WATER: HydroContext = {
  searchRadiusM: 500,
  nearestWatercourseM: null,
  nearestDitchM: null,
  nearestWaterBodyM: null,
  nearestWetlandM: null,
  waterBodies: 0,
  wetlands: 0,
  ditchesInRadius: 0,
  ditchLengthInFieldM: 0,
  features: [],
  treeCoverShare: null,
};

const NORMAL: Partial<DailyWeather> = {
  precipMm: 2.2,
  tMinC: 12,
  tMaxC: 24,
  tMeanC: 18,
  solarMjM2: 18,
  et0Mm: 3,
};
const DRY: Partial<DailyWeather> = {
  precipMm: 0.3,
  tMinC: 15,
  tMaxC: 31,
  tMeanC: 23,
  solarMjM2: 24,
  et0Mm: 5,
};

/** 10 lat zwyklej pogody, a ostatnie `dryDays` dni przed data analizy - susza z upalem. */
function weather(date: string, dryDays: number): MeteoSeries {
  const from = addDays(addYears(date, -10), -120);
  const dryFrom = addDays(date, -dryDays);

  return {
    gridKm: 55,
    elevationM: 120,
    days: Array.from({ length: daysBetween(from, date) + 1 }, (_unused, index) => {
      const day = addDays(from, index);

      return {
        date: day,
        humidityPct: 70,
        windMs: 2.5,
        precipMm: 2,
        tMinC: 12,
        tMaxC: 24,
        tMeanC: 18,
        et0Mm: 3,
        ...(day > dryFrom ? DRY : NORMAL),
      };
    }),
  };
}

function stageInput(
  date: string,
  dryDays: number,
  extra: Partial<StageInput> = {},
  cropId: CropId = 'winter_wheat',
): StageInput {
  return {
    field: FIELD,
    cropId,
    date,
    crop: cropAtDate(cropId, date),
    meteo: weather(date, dryDays),
    forecast: null,
    soil: LOAM,
    terrain: null,
    hydro: NO_WATER,
    vegetation: null,
    sampleSources: [],
    ...extra,
  };
}

const ids = (input: StageInput, assessment: Assessment = assess(input), past?: History) =>
  causes(input, assessment, past).map((cause) => cause.id);

describe('causes', () => {
  it('susza po suchym i goracym lecie: niedobor opadu i duze parowanie wzgledem tego samego okresu z 10 lat', () => {
    const input = stageInput('2018-07-15', 70);
    const assessment = assess(input);
    const found = causes(input, assessment);
    const precipitation = found.find((cause) => cause.id === 'precipitation_deficit');
    const demand = found.find((cause) => cause.id === 'high_evaporative_demand');

    expect(assessment.level).toBe('drought');
    expect(precipitation?.evidence[0]).toMatchObject({
      metric: 'precip_period',
      unit: 'mm',
      source: 'meteo',
    });
    expect(precipitation?.evidence[0]?.value).toBeLessThan(
      (precipitation?.evidence[0]?.reference ?? 0) * 0.8,
    );
    expect(demand?.evidence[0]?.value).toBeGreaterThan((demand?.evidence[0]?.reference ?? 0) * 1.1);
    // gliniasta gleba i brak wody w otoczeniu: retencja gleby nie jest przyczyna, krajobraz tak
    expect(found.map((cause) => cause.id)).not.toContain('low_soil_retention');
    expect(found.map((cause) => cause.id)).toContain('no_landscape_retention');
    expect(found.every((cause) => cause.weight > 0 && cause.weight <= 1 && cause.evidence.length > 0)).toBe(
      true,
    );
    expect(found.map((cause) => cause.weight)).toEqual(
      found.map((cause) => cause.weight).toSorted((a, b) => b - a),
    );
  });

  it('lekka gleba to przyczyna; ta sama gleba z atrapy nie jest dowodem', () => {
    const real = ids(stageInput('2018-07-15', 70, { soil: SAND }));
    const sample = ids(stageInput('2018-07-15', 70, { soil: SAND, sampleSources: ['soil', 'hydro'] }));

    expect(real).toContain('low_soil_retention');
    expect(sample).not.toContain('low_soil_retention');
    expect(sample).not.toContain('no_landscape_retention');
  });

  it('row przez pole przyspiesza odplyw (odleglosc 0, dlugosc w polu); woda stojaca w 500 m - krajobraz retencjonuje', () => {
    const input = stageInput('2018-07-15', 70, {
      hydro: { ...NO_WATER, nearestDitchM: 0, ditchLengthInFieldM: 240, ditchesInRadius: 40, waterBodies: 1 },
    });
    const drainage = causes(input, assess(input)).find((cause) => cause.id === 'fast_drainage');

    expect(drainage?.evidence.map((item) => [item.metric, item.value])).toEqual([
      ['nearest_ditch_m', 0],
      ['ditch_length_in_field_m', 240],
      ['ditches_in_radius', 40],
    ]);
    expect(ids(input)).not.toContain('no_landscape_retention');
  });

  it('poza sezonem (listopad) nie ma przyczyn, chyba ze susza wraca w historii - wtedy tylko przyczyny trwale', () => {
    const wet = stageInput('2021-11-15', 0, { soil: SAND });
    const assessment = assess(wet);
    const past = history(wet);
    const recurrent: History = { ...past, seasonsWithData: 10, droughtSeasons: 5 };

    expect(assessment.level).toBe('out_of_season');
    expect(ids(wet, assessment)).toEqual([]);
    expect(recurrentDeficit(recurrent)).toBe(true);
    expect(ids(wet, assessment, recurrent).toSorted()).toEqual([
      'crop_sensitivity',
      'low_soil_retention',
      'no_landscape_retention',
    ]);
  });

  it('bez oceny (brak pogody) nie ma przyczyn', () => {
    const input = stageInput('2018-07-15', 70, { meteo: null, soil: SAND });

    expect(ids(input)).toEqual([]);
  });
});
