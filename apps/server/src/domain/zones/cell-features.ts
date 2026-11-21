// Cechy komorek siatki pola z danych zrodel: wysokosc, spadek, wskaznik gromadzenia wody (TWI) i glebokosc
// zaglebienia z modelu terenu (siatka EPSG:3857, probkowana w srodku komorki), NDVI/NDMI z rastra Sentinel-2
// (ta sama siatka co komorki) i odleglosc od rowu albo cieku z hydrografii. Brak danych = NaN.
import type { HydroContext, TerrainGrid, VegetationRaster } from '../analysis-ports';
import { cellLngLat, type GridCell, type GridSpec } from '../field-grid';
import { fillDepressions, slopePercent, wetnessIndex } from '../terrain';
import { toUtm } from '../utm';

export interface CellFeatures {
  elevationM: number;
  slopePct: number;
  wetnessIndex: number;
  /** glebokosc wody, ktora zatrzymaloby zaglebienie bez odplywu (m) */
  depressionDepthM: number;
  ndvi: number;
  ndmi: number;
  /** odleglosc od rowu albo cieku (m); NaN = brak w promieniu przeszukania */
  ditchM: number;
}

const EARTH_RADIUS_M = 6_378_137;
const RAD = Math.PI / 180;

/** Probkowanie terenu: pochodne liczone raz dla calej siatki, potem najblizszy wezel dla srodka komorki. */
function terrainSampler(grid: TerrainGrid | null) {
  if (!grid || grid.crs !== 'EPSG:3857') return null;

  const slopes = slopePercent(grid);
  const wetness = wetnessIndex(grid);
  const filled = fillDepressions(grid);
  const step = grid.crsCellSize ?? grid.cellSizeM;

  return ([lng, lat]: [number, number]) => {
    const x = EARTH_RADIUS_M * lng * RAD;
    const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
    const col = Math.floor((x - grid.originX) / step);
    const row = Math.floor((grid.originY - y) / step);

    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;

    const index = row * grid.cols + col;
    const elevation = grid.elevationM[index] ?? Number.NaN;

    return {
      elevationM: elevation,
      slopePct: slopes[index] ?? Number.NaN,
      wetnessIndex: wetness[index] ?? Number.NaN,
      depressionDepthM: Math.max(0, (filled[index] ?? elevation) - elevation),
    };
  };
}

function rasterSampler(raster: VegetationRaster | null, spec: GridSpec) {
  if (!raster || raster.epsg !== spec.epsg) return null;

  return (cell: GridCell) => {
    const col = Math.floor((cell.easting - raster.west) / raster.cellSizeM);
    const row = Math.floor((raster.north - cell.northing) / raster.cellSizeM);

    if (col < 0 || row < 0 || col >= raster.cols || row >= raster.rows) return null;

    const index = row * raster.cols + col;

    return { ndvi: raster.ndvi[index] ?? Number.NaN, ndmi: raster.ndmi[index] ?? Number.NaN };
  };
}

/** Odleglosc punktu od odcinka (metry w ukladzie UTM). */
function segmentDistance(px: number, py: number, [ax, ay]: number[], [bx, by]: number[]): number {
  const dx = (bx ?? 0) - (ax ?? 0);
  const dy = (by ?? 0) - (ay ?? 0);
  const length = dx * dx + dy * dy;
  const t =
    length === 0 ? 0 : Math.min(1, Math.max(0, ((px - (ax ?? 0)) * dx + (py - (ay ?? 0)) * dy) / length));

  return Math.hypot(px - ((ax ?? 0) + t * dx), py - ((ay ?? 0) + t * dy));
}

function ditchSampler(hydro: HydroContext | null, spec: GridSpec) {
  const lines = (hydro?.features ?? [])
    .filter((feature) => feature.kind === 'ditch' || feature.kind === 'watercourse')
    .map((feature) => feature.coordinates.map(([lng, lat]) => toUtm(lng, lat, spec.zone)));

  if (lines.length === 0) return null;

  return (cell: GridCell) => {
    let best = Number.POSITIVE_INFINITY;

    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        const distance = segmentDistance(
          cell.easting,
          cell.northing,
          line[index - 1] ?? [],
          line[index] ?? [],
        );

        if (distance < best) best = distance;
      }
    }

    return Number.isFinite(best) ? best : Number.NaN;
  };
}

export interface FeatureSources {
  terrain: TerrainGrid | null;
  raster: VegetationRaster | null;
  hydro: HydroContext | null;
}

/** Cechy wszystkich komorek pola i informacja, z jakich danych pochodza. */
export function cellFeatures(
  spec: GridSpec,
  cells: readonly GridCell[],
  sources: FeatureSources,
): { features: CellFeatures[]; basis: ('vegetation' | 'terrain' | 'hydro')[] } {
  const terrain = terrainSampler(sources.terrain);
  const raster = rasterSampler(sources.raster, spec);
  const ditch = ditchSampler(sources.hydro, spec);
  const features = cells.map((cell): CellFeatures => {
    const ground = terrain?.(cellLngLat(spec, cell)) ?? null;
    const plants = raster?.(cell) ?? null;

    return {
      elevationM: ground?.elevationM ?? Number.NaN,
      slopePct: ground?.slopePct ?? Number.NaN,
      wetnessIndex: ground?.wetnessIndex ?? Number.NaN,
      depressionDepthM: ground?.depressionDepthM ?? Number.NaN,
      ndvi: plants?.ndvi ?? Number.NaN,
      ndmi: plants?.ndmi ?? Number.NaN,
      ditchM: ditch?.(cell) ?? Number.NaN,
    };
  });
  const has = (key: keyof CellFeatures) => features.some((item) => Number.isFinite(item[key]));

  return {
    features,
    basis: [
      ...(has('ndmi') ? (['vegetation'] as const) : []),
      ...(has('elevationM') ? (['terrain'] as const) : []),
      ...(has('ditchM') ? (['hydro'] as const) : []),
    ],
  };
}
