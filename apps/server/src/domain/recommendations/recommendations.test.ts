import type { Assessment, Cause, FieldArea, RootZone, Surroundings } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { HydroContext, SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { saxtonRawls } from '../soil-water';
import { irrigationAdvice, irrigationSchedule, organicMatterGainMm, recommend } from './recommendations';

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

const terrainWith = (largestDepression?: { areaM2: number; volumeM3: number; maxDepthM: number }) => ({
  grid: { crs: 'test', originX: 0, originY: 0, cellSizeM: 6, cols: 1, rows: 1, elevationM: [100] },
  summary: {
    elevationMinM: 99,
    elevationMaxM: 101,
    slopeMeanPct: 4,
    slopeShareAbove5Pct: 0.3,
    depressions: largestDepression ? 1 : 0,
    ...(largestDepression ? { largestDepression } : {}),
  },
});

describe('recommend', () => {
  it('oczko w zaglebieniu pola: pojemnosc z modelu terenu, jedno zalecenie oczka, nie z atrapy terenu', () => {
    const loam = { ...SOIL, availableWaterMmPerM: 150, category: 3 as const };
    const bowl = terrainWith({ areaM2: 900, volumeM3: 240, maxDepthM: 0.6 });
    const causes = [cause('precipitation_deficit', 0.7), cause('no_landscape_retention', 0.3)];
    const ponds = (extra: Partial<StageInput>) =>
      recommend(input({ soil: loam, ...extra }), assessment('drought'), causes).retention.filter(
        (item) => item.measure === 'small_pond',
      );
    const [pond, ...more] = ponds({ terrain: bowl });

    expect(more).toHaveLength(0);
    expect(pond).toMatchObject({
      priority: 1,
      effect: { kind: 'volume_m3', value: 240 },
      legal: 'notification',
    });
    // niecka wieksza niz 1000 m2 - staw wymaga pozwolenia wodnoprawnego
    expect(ponds({ terrain: terrainWith({ areaM2: 4600, volumeM3: 1900, maxDepthM: 0.9 }) })[0]?.legal).toBe(
      'permit',
    );
    expect(pond?.evidence.map((item) => item.metric)).toContain('depression_volume_m3');
    // atrapa terenu albo male zaglebienie: oczko tylko z braku retencji w otoczeniu, bez objetosci
    expect(ponds({ terrain: bowl, sampleSources: ['terrain'] })[0]).toMatchObject({
      priority: 2,
      effect: null,
    });
    expect(
      ponds({ terrain: terrainWith({ areaM2: 50, volumeM3: 10, maxDepthM: 0.2 }) })[0]?.effect,
    ).toBeNull();
  });

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

// Otoczenie jak 080904_5.0001.349/1 (Chwalim, dane z bazy 22.11.2026): granica 1900 m bez drzew, jaz 347 m, waly
const OPEN_FIELD: Surroundings = {
  trees: {
    bandM: 15,
    edgeM: 1900,
    woodedEdgeM: 0,
    woodedEdgeShare: 0,
    nearestForestM: null,
    nearestTreeRowM: 137,
    searchRadiusM: 500,
    openToWind: true,
  },
  water: {
    searchRadiusM: 3000,
    nearestStructure: { kind: 'weir', distanceM: 347, name: null },
    structures: 6,
    levees: 44,
    nearestLeveeM: 1106,
    nearestSpring: null,
    nearestIntakeM: null,
    pipedSegments: 0,
    pipedJunction: null,
    junctionRadiusM: 500,
  },
  protectedAreas: [],
};

describe('recommend z otoczeniem pola', () => {
  const landscape = [cause('no_landscape_retention', 0.3), cause('high_evaporative_demand', 0.4)];
  const measures = (extra: Partial<StageInput>, causes: Cause[] = landscape) =>
    recommend(input(extra), assessment('drought'), causes).retention;

  it('pas zadrzewien przy granicy bez drzew - z liczba; pole oslonione lasem go nie dostaje', () => {
    const trees = measures({ surroundings: OPEN_FIELD }).find(
      (item) => item.measure === 'field_margin_trees',
    );
    const sheltered: Surroundings = {
      ...OPEN_FIELD,
      trees: { ...OPEN_FIELD.trees, edgeM: 217, woodedEdgeM: 217, woodedEdgeShare: 1, openToWind: false },
    };

    expect(trees?.evidence).toContainEqual({
      metric: 'wooded_edge_m',
      value: 0,
      unit: 'm',
      reference: 1900,
      source: 'hydro',
    });
    expect(measures({ surroundings: sheltered }).map((item) => item.measure)).not.toContain(
      'field_margin_trees',
    );
    // bez danych o drzewach - jak dotad, zalecenie zostaje
    expect(measures({}).map((item) => item.measure)).toContain('field_margin_trees');

    // ta sama miara z przyczyny i z reguly - w zaleceniu raz
    const fromCauses = landscape.map((item) => ({
      ...item,
      evidence: [{ metric: 'wooded_edge_m', value: 0, unit: 'm', reference: 1900, source: 'hydro' as const }],
    }));

    expect(
      measures({ surroundings: OPEN_FIELD }, fromCauses)
        .find((item) => item.measure === 'field_margin_trees')
        ?.evidence.filter((item) => item.metric === 'wooded_edge_m'),
    ).toHaveLength(1);
  });

  it('zastawka: pytanie o istniejace urzadzenie, jaz 347 m z pytaniem do zarzadcy, styk rowu z rura', () => {
    const withJunction: Surroundings = {
      ...OPEN_FIELD,
      water: { ...OPEN_FIELD.water, pipedJunction: { distanceM: 106, point: [22.851388, 54.04103] } },
    };
    const weir = measures({ surroundings: withJunction }, ALL).find((item) => item.measure === 'ditch_weir');

    expect(weir?.notes?.map((note) => note.id)).toEqual([
      'check_existing_structure',
      'piped_junction',
      'structure_nearby',
    ]);
    expect(weir?.notes?.[0]?.text).toContain('Sprawdź, czy na tym rowie jest już zastawka albo przepust');
    expect(weir?.notes?.[1]?.text).toBe(
      '106 m od pola otwarty rów wchodzi w rurę (zwykle przepust pod drogą) — to naturalne miejsce na piętrzenie wody w rowie.',
    );
    expect(weir?.notes?.[2]?.text).toBe(
      '347 m od pola jest jaz — zapytaj zarządcę (spółka wodna, Wody Polskie), czy piętrzy wodę i w jakich miesiącach.',
    );
    expect(weir?.evidence.map((item) => item.metric)).toEqual(
      expect.arrayContaining(['nearest_structure_m', 'piped_junction_m']),
    );
    // bez danych otoczenia tez pytamy o istniejaca zastawke - BDOT10k ich nie zna
    expect(
      measures({}, ALL)
        .find((item) => item.measure === 'ditch_weir')
        ?.notes?.map((note) => note.id),
    ).toEqual(['check_existing_structure']);
  });

  it('obszar chroniony: zastrzezenie z nazwa przy oczku i zastawce, nie przy pasie zadrzewien', () => {
    const loam = { ...SOIL, availableWaterMmPerM: 150, category: 3 as const };
    const biebrza: Surroundings = {
      ...OPEN_FIELD,
      protectedAreas: [
        { kind: 'national_park', name: 'Biebrzański Park Narodowy' },
        { kind: 'natura2000', name: 'Dolina Biebrzy' },
        { kind: 'natura2000', name: 'Ostoja Biebrzańska' },
      ],
    };
    const retention = measures({ surroundings: biebrza, soil: loam }, [...ALL, ...landscape]);
    const notesOf = (measure: string) =>
      retention
        .find((item) => item.measure === measure)
        ?.notes?.filter((note) => note.id === 'protected_area');

    expect(notesOf('small_pond')?.map((note) => note.text)).toEqual([
      'Pole leży w parku narodowym (Biebrzański Park Narodowy). Ustawa o ochronie przyrody zakazuje tam zmian stosunków wodnych, które nie służą ochronie przyrody (art. 15 ust. 1 pkt 7) — zanim zaczniesz, uzgodnij to z dyrekcją parku.',
      'Pole leży w obszarze Natura 2000 (Dolina Biebrzy, Ostoja Biebrzańska). Zakazane są działania, które mogą znacząco pogorszyć stan chronionych tam siedlisk i gatunków (art. 33 ust. 1 ustawy o ochronie przyrody) — zapytaj regionalnego dyrektora ochrony środowiska, czy ta zmiana stosunków wodnych może na nie wpłynąć.',
    ]);
    expect(notesOf('ditch_weir')).toHaveLength(2);
    expect(retention.find((item) => item.measure === 'field_margin_trees')?.notes).toBeUndefined();
  });

  it('zrodlo przy polu jako argument za oczkiem; ujecie wody nie trafia do zalecen', () => {
    const loam = { ...SOIL, availableWaterMmPerM: 150, category: 3 as const };
    const spring: Surroundings = {
      ...OPEN_FIELD,
      water: {
        ...OPEN_FIELD.water,
        nearestSpring: { distanceM: 210, name: 'Źródło Marii' },
        nearestIntakeM: 400,
      },
    };
    const pond = measures({ surroundings: spring, soil: loam }).find((item) => item.measure === 'small_pond');

    expect(pond?.notes).toEqual([
      {
        id: 'spring_nearby',
        text: 'Źródło „Źródło Marii” 210 m od pola może zasilać oczko wodą także w suchym okresie — sprawdź, czy płynie latem.',
      },
    ]);
    expect(pond?.evidence).toContainEqual({
      metric: 'nearest_spring_m',
      value: 210,
      unit: 'm',
      reference: 500,
      source: 'hydro',
    });
    expect(JSON.stringify(pond)).not.toContain('ujęci');
  });

  it('polder (Zulawy, 221002_5.0011.185): zamiast oczka w obnizeniu - zatrzymanie wody w rowach', () => {
    const loam = { ...SOIL, availableWaterMmPerM: 150, category: 4 as const };
    const polder = {
      soil: loam,
      terrain: {
        ...terrainWith({ areaM2: 24_900, volumeM3: 11_037, maxDepthM: 0.9 }),
        summary: {
          ...terrainWith({ areaM2: 24_900, volumeM3: 11_037, maxDepthM: 0.9 }).summary,
          elevationMinM: -4.7,
        },
      },
      hydro: { ...HYDRO, ditchesInRadius: 156, nearestWetlandM: null, wetlands: 0 },
      surroundings: {
        ...OPEN_FIELD,
        water: { ...OPEN_FIELD.water, nearestStructure: null, nearestLeveeM: null },
      },
    };
    // bez przyczyny "szybki odplyw" (row nie przy samym polu) - zastawka i tak, bo to polder
    const causes = [cause('precipitation_deficit', 0.7), cause('no_landscape_retention', 0.3)];
    const retention = measures(polder, causes);
    const weir = retention.find((item) => item.measure === 'ditch_weir');

    expect(retention.map((item) => item.measure)).not.toContain('small_pond');
    expect(weir?.notes?.map((note) => note.id)).toEqual(['check_existing_structure', 'drained_lowland']);
    expect(weir?.notes?.[1]?.text).toContain('najniższy punkt -4,7 m n.p.m., 156 odcinków rowów');
    expect(weir?.evidence.map((item) => item.metric)).toEqual(
      expect.arrayContaining(['elevation_min_m', 'ditches_in_radius']),
    );
    // to samo pole wyzej nad morzem - oczko w zaglebieniu wraca
    expect(
      measures(
        { ...polder, terrain: terrainWith({ areaM2: 24_900, volumeM3: 11_037, maxDepthM: 0.9 }) },
        causes,
      ).map((item) => item.measure),
    ).toContain('small_pond');
  });
});

describe('irrigationAdvice', () => {
  it('silny stres w okresie wzrostu przy suszy: nawodnic dawka do polowej pojemnosci', () => {
    expect(irrigationAdvice(input(), assessment('drought'))).toMatchObject({
      advisable: 'yes',
      netDepthMm: 80,
      withinDays: 0,
      forecastPrecipMm: null,
      doses: expect.any(Number),
      doseMm: expect.any(Number),
    });
  });

  it('niedobor rozbity na dawki deszczowni 20-30 mm, liczbe dawek i odstep z dziennego zuzycia wody', () => {
    // 80 mm niedoboru, 62 mm wody latwo dostepnej, uprawa zuzywa 4,5 mm/d -> 3 x 30 mm co 6 dni
    expect(irrigationSchedule(80, 62, 4.5)).toEqual({ doseMm: 30, doses: 3, intervalDays: 6 });
    // plytkie korzenie (12 mm latwo dostepnej wody): dawka nie schodzi ponizej 20 mm; bez zuzycia - bez odstepu
    expect(irrigationSchedule(45, 12, null)).toEqual({ doseMm: 20, doses: 3 });
    // 22 mm wody latwo dostepnej -> dawka 20 mm; upal 8 mm/d -> odstep min. 2 dni
    expect(irrigationSchedule(22, 22, 8)).toEqual({ doseMm: 20, doses: 2, intervalDays: 2 });
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
