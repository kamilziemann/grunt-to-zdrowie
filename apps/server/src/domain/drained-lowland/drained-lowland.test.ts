import type { FieldArea, Surroundings } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { HydroContext, TerrainData } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { drainedLowland } from './drained-lowland';

const FIELD: FieldArea = {
  id: 'parcels:test',
  kind: 'parcel',
  parcelIds: ['221002_5.0011.185'],
  label: '185 · Orłowo',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [19.05, 54.21],
  bbox: [19.045, 54.205, 19.056, 54.212],
  areaHa: 8.75,
};

const terrain = (elevationMinM: number): TerrainData => ({
  grid: {
    crs: 'EPSG:3857',
    originX: 0,
    originY: 0,
    cellSizeM: 30,
    cols: 1,
    rows: 1,
    elevationM: [elevationMinM],
  },
  summary: {
    elevationMinM,
    elevationMaxM: elevationMinM + 1.5,
    slopeMeanPct: 0.6,
    slopeShareAbove5Pct: 0,
    depressions: 1,
  },
});

const hydro = (ditchesInRadius: number): HydroContext => ({
  searchRadiusM: 500,
  nearestWatercourseM: null,
  nearestDitchM: 0,
  waterBodies: 0,
  wetlands: 0,
  ditchesInRadius,
  ditchLengthInFieldM: 410,
  features: [],
  treeCoverShare: null,
});

const surroundings = (nearestLeveeM: number | null): Surroundings => ({
  trees: {
    bandM: 15,
    edgeM: 1632,
    woodedEdgeM: 0,
    woodedEdgeShare: 0,
    nearestForestM: 495,
    nearestTreeRowM: null,
    searchRadiusM: 500,
    openToWind: true,
  },
  water: {
    searchRadiusM: 3000,
    nearestStructure: null,
    structures: 0,
    levees: nearestLeveeM === null ? 0 : 3,
    nearestLeveeM,
    nearestSpring: null,
    nearestIntakeM: null,
    pipedSegments: 0,
    pipedJunction: null,
    junctionRadiusM: 500,
  },
  protectedAreas: [],
});

const DATE = '2023-06-20';

const input = (extra: Partial<StageInput>): StageInput => ({
  field: FIELD,
  cropId: 'winter_wheat',
  date: DATE,
  crop: cropAtDate('winter_wheat', DATE),
  meteo: null,
  forecast: null,
  soil: null,
  terrain: null,
  hydro: null,
  vegetation: null,
  ...extra,
});

describe('drainedLowland', () => {
  // 221002_5.0011.185 (Orlowo, Zulawy Wislane) - dane z 22.11.2026: zaglebienie pola -4,7 m n.p.m. wg modelu 30 m,
  // 156 odcinkow rowow w 500 m, najblizszy wal 3050 m (poza promieniem)
  it('Zulawy (221002_5.0011.185): ponizej poziomu morza i gesta siec rowow to polder, nawet bez walu w 3 km', () => {
    const result = drainedLowland(
      input({ terrain: terrain(-4.7), hydro: hydro(156), surroundings: surroundings(null) }),
    );

    expect(result.detected).toBe(true);
    expect(result.evidence).toEqual([
      { metric: 'elevation_min_m', value: -4.7, unit: 'm', reference: 2, source: 'terrain' },
      { metric: 'ditches_in_radius', value: 156, unit: 'count', reference: 500, source: 'hydro' },
    ]);
  });

  it('nizina nad morzem z walem w poblizu i gestymi rowami tez; bez walu - nie', () => {
    const coastal = { terrain: terrain(1.4), hydro: hydro(60) };

    expect(drainedLowland(input({ ...coastal, surroundings: surroundings(800) })).evidence).toContainEqual({
      metric: 'nearest_levee_m',
      value: 800,
      unit: 'm',
      source: 'hydro',
    });
    expect(drainedLowland(input({ ...coastal, surroundings: surroundings(null) })).detected).toBe(false);
  });

  it('pole w Wielkopolsce (080904_5.0001.349/1: ok. 60 m n.p.m., 10 rowow) i rzadka siec rowow to nie polder', () => {
    expect(drainedLowland(input({ terrain: terrain(61), hydro: hydro(10) })).detected).toBe(false);
    expect(drainedLowland(input({ terrain: terrain(-1), hydro: hydro(12) })).detected).toBe(false);
  });

  it('bez terenu albo z atrapy - brak rozpoznania', () => {
    expect(drainedLowland(input({ hydro: hydro(156) })).detected).toBe(false);
    expect(
      drainedLowland(input({ terrain: terrain(-4.7), hydro: hydro(156), sampleSources: ['terrain'] }))
        .detected,
    ).toBe(false);
  });
});
