import type { ParcelGeometry, Zone } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { TerrainGrid, VegetationRaster } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cellsInField, fieldGrid, type GridCell, type GridSpec } from '../field-grid';
import { fromUtm } from '../utm';
import type { CellFeatures } from './cell-features';
import { describeZone } from './describe';
import { fieldZones, principalAxis, profileFromCells, zoneForMeasure, zonesFromCells } from './zones';

const E0 = 600_000;
const N0 = 5_780_000;

/** Prostokat w metrach UTM strefy 34 (od naroznika poludniowo-zachodniego) jako geometria WGS84. */
function rectangle(width: number, height: number): ParcelGeometry {
  const corners: [number, number][] = [
    [E0, N0],
    [E0 + width, N0],
    [E0 + width, N0 + height],
    [E0, N0 + height],
    [E0, N0],
  ];

  return { type: 'Polygon', coordinates: [corners.map(([e, n]) => fromUtm(e, n, 34))] };
}

function grid(width: number, height: number): { spec: GridSpec; cells: GridCell[] } {
  const geometry = rectangle(width, height);
  const spec = fieldGrid(geometry, 22.46, (width * height) / 10_000);

  return { spec, cells: cellsInField(spec, geometry) };
}

const PLAIN: CellFeatures = {
  elevationM: 100,
  slopePct: 1,
  wetnessIndex: 8,
  depressionDepthM: 0,
  ndvi: 0.7,
  ndmi: 0.3,
  ditchM: Number.NaN,
};

/** Cechy komorek z funkcji polozenia (x, y w metrach od poludniowo-zachodniego naroznika pola). */
function features(
  cells: readonly GridCell[],
  at: (x: number, y: number) => Partial<CellFeatures>,
): CellFeatures[] {
  return cells.map((cell) => ({ ...PLAIN, ...at(cell.easting - E0, cell.northing - N0) }));
}

/** Szum +-amplituda, powtarzalny (bez Math.random). */
const noise = (x: number, y: number, amplitude: number) => Math.sin(x * 12.9898 + y * 78.233) * amplitude;

describe('zonesFromCells', () => {
  it('suchszy pagorek na NE i zaglebienie na SW daja trzy strefy z opisem, udzialem i pojemnoscia', () => {
    const { spec, cells } = grid(200, 200);
    const values = features(cells, (x, y) => {
      if (x > 130 && y > 130) return { ndmi: 0.18, elevationM: 104, wetnessIndex: 5 };

      if (x < 50 && y < 50) return { ndmi: 0.36, elevationM: 98, wetnessIndex: 12, depressionDepthM: 0.3 };

      return { ndmi: 0.3 + noise(x, y, 0.01) };
    });
    const { zones, reason } = zonesFromCells(spec, cells, values);
    const kinds = zones.map((zone) => [zone.kind, zone.position, zone.relief]);

    expect(reason).toBeUndefined();
    expect(kinds).toEqual([
      ['drying', 'ne', 'hilltop'],
      ['depression', 'sw', 'hollow'],
      ['typical', 'centre', 'flat'],
    ]);
    expect(zones[0]?.areaHa).toBeCloseTo(0.49, 1);
    expect(zones[0]?.description).toBe(
      'Suchsze miejsce na wzniesieniu, w północno-wschodniej części pola, ok. 0,5 ha',
    );
    // 25 komorek x 0,3 m x 100 m2; wygladzenie moze sciac wewnetrzny naroznik niecki
    expect(zones[1]?.volumeM3).toBeGreaterThanOrEqual(0.3 * 2300);
    expect(zones[1]?.volumeM3).toBeLessThanOrEqual(0.3 * 2500);
    expect(zones.reduce((sum, zone) => sum + (zone.share ?? 0), 0)).toBeCloseTo(1, 1);
    expect(zones[0]?.geometry.type).toBe('Polygon');
  });

  it('jednorodne pole z szumem: jedna strefa i powod "uniform"', () => {
    const { spec, cells } = grid(150, 150);
    const { zones, reason } = zonesFromCells(
      spec,
      cells,
      features(cells, (x, y) => ({ ndmi: 0.3 + noise(x, y, 0.01), wetnessIndex: 8 + noise(y, x, 0.3) })),
    );

    expect(reason).toBe('uniform');
    expect(zones.map((zone) => zone.kind)).toEqual(['typical']);
  });

  it('odosobnione piksele (mniej niz 0,05 ha) nie robia strefy', () => {
    const { spec, cells } = grid(150, 150);
    const values = features(cells, (x, y) => ({ ndmi: x > 70 && x < 90 && y > 70 && y < 80 ? 0.1 : 0.3 }));

    expect(zonesFromCells(spec, cells, values).reason).toBe('uniform');
  });
});

describe('profil podluzny', () => {
  it('pas 30 x 600 m: os wzdluz polnoc-poludnie, 6 odcinkow po 100 m, suchy koniec opisany', () => {
    const { spec, cells } = grid(30, 600);
    const axis = principalAxis(cells, spec.cellSizeM);
    const values = features(cells, (_x, y) => ({ ndmi: y > 500 ? 0.15 : 0.3, elevationM: 100 + y / 100 }));
    const { zones, profileStart } = profileFromCells(spec, cells, values);

    expect(axis.widthM).toBeCloseTo(30, 0);
    expect(axis.lengthM).toBeCloseTo(600, 0);
    expect(zones).toHaveLength(6);
    expect(zones.map((zone) => zone.toM)).toEqual([100, 200, 300, 400, 500, 600]);
    expect(['n', 's']).toContain(profileStart);

    const dry = zones.find((zone) => zone.moisture === 'drier');

    expect(dry?.description).toMatch(
      /^Odcinek (0–100|500–600) m od (północnego|południowego) końca: suchszy/,
    );
  });
});

function stageInput(geometry: ParcelGeometry, areaHa: number, extra: Partial<StageInput> = {}): StageInput {
  return {
    field: {
      id: 'area:test',
      kind: 'drawn',
      parcelIds: [],
      label: 'test',
      geometry,
      centroid: [22.46, 52.16],
      bbox: [22.4, 52.1, 22.5, 52.2],
      areaHa,
    },
    cropId: 'winter_wheat',
    date: '2023-06-20',
    crop: { cropId: 'winter_wheat', iungGroup: 'winter_cereals', stage: 'mid', kc: 1.15, rootDepthM: 1.2 },
    meteo: null,
    forecast: null,
    soil: null,
    terrain: null,
    hydro: null,
    vegetation: null,
    ...extra,
  };
}

/** Raster na siatce pola z funkcji polozenia. */
function raster(spec: GridSpec, ndmi: (x: number, y: number) => number): VegetationRaster {
  const values = Array.from({ length: spec.rows * spec.cols }, (_unused, index) => {
    const x = spec.west + ((index % spec.cols) + 0.5) * spec.cellSizeM - E0;
    const y = spec.north - (Math.floor(index / spec.cols) + 0.5) * spec.cellSizeM - N0;

    return ndmi(x, y);
  });

  return { ...spec, ndvi: values.map(() => 0.7), ndmi: values, from: '2023-05-22', to: '2023-06-20' };
}

/** Siatka terenu EPSG:3857 (krok ok. 5 m w terenie) obejmujaca pole z zapasem: plaszczyzna nachylona na wschod. */
function terrainGrid(): TerrainGrid {
  const [lng, lat] = fromUtm(E0 - 100, N0 + 1100, 34);
  const scale = 1 / Math.cos((lat * Math.PI) / 180);
  const step = 5 * scale;
  const cols = 200;
  const rows = 280;
  const x0 = (6_378_137 * lng * Math.PI) / 180;
  const y0 = 6_378_137 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

  return {
    crs: 'EPSG:3857',
    originX: x0,
    originY: y0,
    cellSizeM: 5,
    crsCellSize: step,
    cols,
    rows,
    elevationM: Array.from({ length: rows * cols }, (_unused, index) => 100 + (index % cols) * 0.1),
  };
}

describe('fieldZones (etap)', () => {
  it('pole ponizej 0,5 ha: pusto i powod "field_too_small"', () => {
    const geometry = rectangle(50, 60);
    const spec = fieldGrid(geometry, 22.46, 0.3);
    const vegetation = { observations: [], baseline: [], cellSizeM: 10, raster: raster(spec, () => 0.3) };
    const result = fieldZones(stageInput(geometry, 0.3, { vegetation }));

    expect(result).toMatchObject({ layout: 'zones', zones: [], reason: 'field_too_small' });
  });

  it('bez rastra i terenu nie ma stref (null)', () => {
    expect(fieldZones(stageInput(rectangle(200, 200), 4))).toBeNull();
  });

  it('pas 30 x 600 m przechodzi na profil podluzny', () => {
    const geometry = rectangle(30, 600);
    const spec = fieldGrid(geometry, 22.46, 1.8);
    const vegetation = { observations: [], baseline: [], cellSizeM: 10, raster: raster(spec, () => 0.3) };

    expect(fieldZones(stageInput(geometry, 1.8, { vegetation }))?.layout).toBe('profile');
  });

  it('2000 komorek z rastrem i terenem: strefy w mniej niz 300 ms', () => {
    const geometry = rectangle(400, 500);
    const spec = fieldGrid(geometry, 22.46, 20);
    const vegetation = {
      observations: [],
      baseline: [],
      cellSizeM: 10,
      raster: raster(spec, (x, y) => (x > 300 && y > 350 ? 0.15 : 0.3 + noise(x, y, 0.01))),
    };
    const terrain = {
      grid: terrainGrid(),
      summary: {
        elevationMinM: 100,
        elevationMaxM: 120,
        slopeMeanPct: 2,
        slopeShareAbove5Pct: 0,
        depressions: 0,
      },
    };
    const started = performance.now();
    const result = fieldZones(stageInput(geometry, 20, { vegetation, terrain }));
    const elapsed = performance.now() - started;

    expect(result?.cells).toBe(2000);
    expect(result?.basis).toEqual(['vegetation', 'terrain']);
    expect(result?.zones.some((zone) => zone.kind === 'drying' && zone.position === 'ne')).toBe(true);
    expect(elapsed).toBeLessThan(300);
  });
});

describe('zoneForMeasure', () => {
  it('oczko w zaglebieniu, pas trawiasty na stoku, zastawka przy rowie; bez podzialu - cale pole', () => {
    const zone = (id: string, extra: object) => ({
      id,
      kind: 'typical' as const,
      areaHa: 1,
      geometry: rectangle(10, 10),
      ...extra,
    });
    const map = {
      layout: 'zones' as const,
      cellSizeM: 10,
      cells: 400,
      zones: [
        zone('dry', { kind: 'drying', moisture: 'drier', slopePct: 4 }),
        zone('pond', { kind: 'depression', moisture: 'wetter', ditchDistanceM: 20 }),
        zone('rest', { moisture: 'typical', slopePct: 1 }),
      ],
    };

    expect(zoneForMeasure('small_pond', map)).toBe('pond');
    expect(zoneForMeasure('grassed_waterway', map)).toBe('dry');
    expect(zoneForMeasure('ditch_weir', map)).toBe('pond');
    expect(zoneForMeasure('reduced_tillage', map)).toBeNull();
    expect(zoneForMeasure('small_pond', { ...map, zones: [zone('rest', {})] })).toBeNull();
  });
});

describe('describeZone', () => {
  const zone: Zone = {
    id: 'zone-1',
    kind: 'drying',
    areaHa: 4,
    geometry: { type: 'Polygon', coordinates: [] },
    position: 'w',
    relief: 'flat',
  };

  // 080904_5.0001.349/1 (2023-06-20): suchsza strefa 4 ha na zachodzie, NDMI -0,58 wzgledem pola - to raczej inny
  // uzytek (lace i rowy w ewidencji) niz susza jednej uprawy
  it('duza roznica NDMI dostaje zdanie ostroznosci, mala - nie; reszta pola nigdy', () => {
    expect(describeZone({ ...zone, ndmiDelta: -0.58 })).toBe(
      'Suchsze miejsce, w zachodniej części pola, ok. 4,0 ha. Tak duża różnica wilgotności roślin może też oznaczać inny użytek albo inny stan pola (np. łąka obok ścierniska) — sprawdź na miejscu.',
    );
    expect(describeZone({ ...zone, ndmiDelta: -0.05 })).toBe(
      'Suchsze miejsce, w zachodniej części pola, ok. 4,0 ha',
    );
    expect(describeZone({ ...zone, kind: 'typical', ndmiDelta: 0.3 })).not.toContain('inny użytek');
  });
});
