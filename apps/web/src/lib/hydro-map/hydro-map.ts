// Warstwa "Rowy i cieki" (BDOT10k) bez MapLibre: kafle siatki XYZ w przyblizeniu HYDRO_TILE_ZOOM, pobranie kafla
// z walidacja kontraktu, kolekcje GeoJSON do rysowania i najblizszy obiekt wzgledem pola (mapa w raporcie).
// Wspolne dla mapy dzialek i mapy w raporcie; warstwy MapLibre sa w `hydro-layers.ts`.
import {
  HYDRO_TILE_ZOOM,
  hydroTileSchema,
  type HydroFeature,
  type HydroFeatureKind,
  type HydroTile,
  type ParcelGeometry,
} from '@app/contracts';
import { unwrap } from '@app/rpc';
import type { Feature, FeatureCollection, Position } from 'geojson';

import { getApi } from '../api';

export interface HydroTileIndex {
  x: number;
  y: number;
}

/** Od tego przyblizenia mapy warstwa sie pobiera: wczesniej kafli w widoku jest za duzo. */
export const HYDRO_MIN_ZOOM = 13;
/** Wiecej kafli w widoku = za male przyblizenie albo ogromny ekran; nie zasypujemy API zapytaniami. */
export const MAX_HYDRO_TILES = 30;
/** Ile kafli trzymamy w pamieci mapy (starsze spoza widoku wypadaja). */
export const HYDRO_TILE_CACHE = 120;

/** Rodzaje rysowane linia (reszta to poligony: wody i mokradla). */
const LINE_KINDS: ReadonlySet<HydroFeatureKind> = new Set(['ditch', 'river', 'stream', 'canal']);

/** Rodzaje, ktore w legendzie i raporcie sa "ciekiem" (woda plynaca), a nie rowem. */
export const WATERCOURSE_KINDS: ReadonlySet<HydroFeatureKind> = new Set([
  'river',
  'stream',
  'canal',
  'flowing_water',
]);

function tileX(lng: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** HYDRO_TILE_ZOOM);
}

function tileY(lat: number): number {
  const rad = (lat * Math.PI) / 180;

  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** HYDRO_TILE_ZOOM);
}

/** Kafle hydrografii pokrywajace prostokat [zachod, poludnie, wschod, polnoc]. */
export function hydroTiles(west: number, south: number, east: number, north: number): HydroTileIndex[] {
  const tiles: HydroTileIndex[] = [];

  for (let x = tileX(west); x <= tileX(east); x += 1) {
    for (let y = tileY(north); y <= tileY(south); y += 1) tiles.push({ x, y });
  }

  return tiles;
}

/** Odpowiedz 404/501/502/503: trasy nie ma albo baza nie odpowiada - warstwa "chwilowo niedostepna". */
export class HydroUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`hydro tile unavailable (${String(status)})`);
    this.name = 'HydroUnavailableError';
  }
}

const UNAVAILABLE_STATUSES = new Set([404, 501, 502, 503]);

/**
 * GET /api/hydro/tile przez typowany klient `getApi()`; odpowiedz dodatkowo sprawdzana `hydroTileSchema` (kafel
 * rysujemy wprost, wiec zly ksztalt ma byc bledem, a nie pustym rysunkiem).
 */
export async function fetchHydroTile(x: number, y: number, signal?: AbortSignal): Promise<HydroTile> {
  const response = await getApi().hydro.tile.$get(
    { query: { x: String(x), y: String(y) } },
    { init: { signal: signal ?? null } },
  );

  if (UNAVAILABLE_STATUSES.has(response.status)) throw new HydroUnavailableError(response.status);

  return hydroTileSchema.parse(await unwrap<HydroTile>(response));
}

function featureKey(feature: HydroFeature): string {
  const first = JSON.stringify(feature.geometry.coordinates).slice(0, 80);

  return `${feature.kind}|${feature.name ?? ''}|${first}`;
}

/**
 * Linie (rowy, cieki, kanaly) i poligony (wody, mokradla) z wielu kafli; obiekt z dwoch kafli wchodzi raz.
 * `properties.kind` steruje stylem, `properties.name` podpisem wzdluz linii.
 */
export function hydroCollections(tiles: Iterable<readonly HydroFeature[]>): {
  lines: FeatureCollection;
  areas: FeatureCollection;
} {
  const seen = new Set<string>();
  const lines: FeatureCollection = { type: 'FeatureCollection', features: [] };
  const areas: FeatureCollection = { type: 'FeatureCollection', features: [] };

  for (const features of tiles) {
    for (const feature of features) {
      const key = featureKey(feature);

      if (seen.has(key)) continue;

      seen.add(key);
      const item: Feature = {
        type: 'Feature',
        properties: { kind: feature.kind, name: feature.name ?? '' },
        geometry: feature.geometry,
      };

      (LINE_KINDS.has(feature.kind) ? lines : areas).features.push(item);
    }
  }

  return { lines, areas };
}

/** Najnowsza data importu BDOT10k z kafli (do legendy); null = zadnej. */
export function latestImport(tiles: Iterable<HydroTile>): string | null {
  let latest: string | null = null;

  for (const tile of tiles) {
    if (tile.importedAt && (latest === null || tile.importedAt > latest)) latest = tile.importedAt;
  }

  return latest;
}

/** Rzut lokalny w metrach wokol punktu odniesienia (na kilka kilometrow wystarczy). */
function projector(origin: Position): (point: Position) => [number, number] {
  const [lng0 = 0, lat0 = 0] = origin;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110_540;

  return ([lng = 0, lat = 0]) => [(lng - lng0) * kx, (lat - lat0) * ky];
}

function segmentDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));

  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function segmentsCross(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): boolean {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function pathsCross(first: readonly [number, number][][], second: readonly [number, number][][]): boolean {
  for (const p of first) {
    for (let i = 1; i < p.length; i += 1) {
      for (const q of second) {
        for (let j = 1; j < q.length; j += 1) {
          const [a, b, c, d] = [p[i - 1], p[i], q[j - 1], q[j]];

          if (a && b && c && d && segmentsCross(a, b, c, d)) return true;
        }
      }
    }
  }

  return false;
}

function inside(point: [number, number], ring: readonly [number, number][]): boolean {
  let result = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi = 0, yi = 0] = ring[i] ?? [];
    const [xj = 0, yj = 0] = ring[j] ?? [];

    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      result = !result;
    }
  }

  return result;
}

/** Ciagi punktow geometrii: linie wprost, poligony - kazdy pierscien. */
function paths(geometry: HydroFeature['geometry'] | ParcelGeometry): Position[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates];

  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();

  return geometry.coordinates;
}

function isArea(geometry: HydroFeature['geometry'] | ParcelGeometry): boolean {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
}

/** Odleglosc (m) miedzy dwiema geometriami: 0, gdy sie przecinaja albo jedna zawiera punkt drugiej. */
export function distanceM(
  field: ParcelGeometry,
  other: HydroFeature['geometry'],
  project: (point: Position) => [number, number],
): number {
  const fieldPaths = paths(field).map((path) => path.map(project));
  const otherPaths = paths(other).map((path) => path.map(project));
  let best = Infinity;

  for (const path of otherPaths) {
    for (const point of path) if (fieldPaths.some((ring) => inside(point, ring))) return 0;
  }

  if (isArea(other)) {
    for (const ring of fieldPaths) {
      for (const point of ring) if (otherPaths.some((area) => inside(point, area))) return 0;
    }
  }

  // linia przecinajaca obrys bez punktu w srodku (row przez waskie pole)
  if (pathsCross(fieldPaths, otherPaths)) return 0;

  // najkrotszy odcinek miedzy obrysami: punkt jednej linii do odcinka drugiej, w obie strony
  for (const [from, to] of [
    [fieldPaths, otherPaths],
    [otherPaths, fieldPaths],
  ] as const) {
    for (const path of from) {
      for (const point of path) {
        for (const target of to) {
          for (let i = 1; i < target.length; i += 1) {
            const a = target[i - 1];
            const b = target[i];

            if (a && b) best = Math.min(best, segmentDistance(point, a, b));
          }
        }
      }
    }
  }

  return best;
}

export interface NearestHydro {
  feature: HydroFeature;
  distanceM: number;
}

/**
 * Najblizszy row i najblizszy ciek (rzeka, strumien, kanal, szerokie koryto) w promieniu `radiusM` od pola, z
 * odlegloscia w metrach; `named` = najblizszy ciek z nazwa (raport podaje nazwe, gdy jest).
 */
export function nearestHydro(
  field: ParcelGeometry,
  features: readonly HydroFeature[],
  radiusM: number,
): { ditch: NearestHydro | null; watercourse: NearestHydro | null; named: NearestHydro | null } {
  const origin = paths(field)[0]?.[0] ?? [0, 0];
  const project = projector(origin);
  let ditch: NearestHydro | null = null;
  let watercourse: NearestHydro | null = null;
  let named: NearestHydro | null = null;

  for (const feature of features) {
    const isDitch = feature.kind === 'ditch';

    if (!isDitch && !WATERCOURSE_KINDS.has(feature.kind)) continue;
    const distance = distanceM(field, feature.geometry, project);

    if (distance > radiusM) continue;
    const candidate = { feature, distanceM: distance };

    if (isDitch) {
      if (!ditch || distance < ditch.distanceM) ditch = candidate;

      continue;
    }

    if (!watercourse || distance < watercourse.distanceM) watercourse = candidate;

    if (feature.name && (!named || distance < named.distanceM)) named = candidate;
  }

  return { ditch, watercourse, named };
}

/** Obiekty w promieniu `radiusM` od pola (mapa w raporcie pokazuje tylko okolice pola). */
export function hydroWithin(
  field: ParcelGeometry,
  features: readonly HydroFeature[],
  radiusM: number,
): HydroFeature[] {
  const project = projector(paths(field)[0]?.[0] ?? [0, 0]);

  return features.filter((feature) => distanceM(field, feature.geometry, project) <= radiusM);
}
