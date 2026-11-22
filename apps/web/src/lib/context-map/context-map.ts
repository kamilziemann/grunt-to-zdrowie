// Warstwy "otoczenie pola" (BDOT10k: drzewa, budowle wodne i waly, obszary chronione) bez MapLibre: pobranie kafla
// z walidacja kontraktu i kolekcje GeoJSON do rysowania. Kafle leza na siatce hydrografii (z = 14), a serwer tnie
// obiekty do kafla - obrysy poligonow sa tu oczyszczane z odcinkow na krawedziach kafli (inaczej las czy park
// narodowy mialby na mapie siatke szwow), a nazwa obszaru chronionego dostaje jeden podpis na widok.
import {
  CONTEXT_TILE_ZOOM,
  contextTileSchema,
  type ContextFeature,
  type ContextFeatureKind,
  type ContextLayer,
  type ContextTile,
} from '@app/contracts';
import { unwrap } from '@app/rpc';
import type { Feature, FeatureCollection, Position } from 'geojson';

import { getApi } from '../api';
import { normalizeText } from '../utils/normalize-text';

/** Odpowiedz 404/501/502/503: trasy nie ma albo baza nie odpowiada - warstwa "chwilowo niedostepna". */
export class ContextUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`context tile unavailable (${String(status)})`);
    this.name = 'ContextUnavailableError';
  }
}

const UNAVAILABLE_STATUSES = new Set([404, 501, 502, 503]);

/** Ile kafli jednej warstwy otoczenia trzymamy w pamieci mapy. */
export const CONTEXT_TILE_CACHE = 60;

/**
 * GET /api/context/tile przez typowany klient `getApi()`; odpowiedz sprawdzana `contextTileSchema` (kafel rysujemy
 * wprost, wiec zly ksztalt ma byc bledem, a nie pustym rysunkiem).
 */
export async function fetchContextTile(
  layer: ContextLayer,
  x: number,
  y: number,
  signal?: AbortSignal,
): Promise<ContextTile> {
  const response = await getApi().context.tile.$get(
    { query: { layer, x: String(x), y: String(y) } },
    { init: { signal: signal ?? null } },
  );

  if (UNAVAILABLE_STATUSES.has(response.status)) throw new ContextUnavailableError(response.status);

  return contextTileSchema.parse(await unwrap<ContextTile>(response));
}

/** Budowle na sieci wodnej rysowane znakiem z podpisem ("jaz"). */
export const STRUCTURE_KINDS: ReadonlySet<ContextFeatureKind> = new Set(['weir', 'dam', 'lock']);

/** Podpisy rodzajow na mapie (z tlumaczen): budowle, zrodla, ujecia, rodzaje obszarow chronionych. */
export type ContextKindLabels = Partial<Record<ContextFeatureKind, string>>;

export interface ContextCollections {
  /** obiekty kafli bez zmian (poligony, linie, punkty) - styl wybiera `properties.kind` i typ geometrii */
  features: FeatureCollection;
  /** obrysy poligonow bez odcinkow lezacych na krawedziach kafli */
  outlines: FeatureCollection;
  /** znaki budowli wodnych (punkt w srodku obiektu) z podpisem `properties.label` */
  marks: FeatureCollection;
}

function featureKey(feature: ContextFeature): string {
  return `${feature.kind}|${feature.name ?? ''}|${JSON.stringify(feature.geometry.coordinates).slice(0, 80)}`;
}

/** Obiekty z wielu kafli; obiekt oddany przez dwa kafle (punkt na krawedzi) wchodzi raz. */
export function uniqueFeatures(tiles: Iterable<ContextTile>): ContextFeature[] {
  const seen = new Set<string>();
  const result: ContextFeature[] = [];

  for (const tile of tiles) {
    for (const feature of tile.features) {
      const key = featureKey(feature);

      if (seen.has(key)) continue;

      seen.add(key);
      result.push(feature);
    }
  }

  return result;
}

const GRID = 2 ** CONTEXT_TILE_ZOOM;
// odcinek na krawedzi kafla: oba konce blizej niz ok. 1-2 m od tej samej linii siatki (serwer przycina w ukladzie
// 1992 i zaokragla do 6 miejsc, wiec krawedz nie jest idealnie rowna linii siatki w WGS84)
const EDGE_EPSILON = 2e-5;

function edgeLng(lng: number): number {
  return (Math.round(((lng + 180) / 360) * GRID) / GRID) * 360 - 180;
}

function edgeLat(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  const y = Math.round(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * GRID);
  const n = Math.PI - (2 * Math.PI * y) / GRID;

  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/** Czy odcinek lezy na krawedzi kafla siatki z14 (ciecie serwera, nie granica obiektu). */
export function onTileEdge([lngA = 0, latA = 0]: Position, [lngB = 0, latB = 0]: Position): boolean {
  const lng = edgeLng(lngA);
  const lat = edgeLat(latA);

  return (
    (Math.abs(lngA - lng) < EDGE_EPSILON && Math.abs(lngB - lng) < EDGE_EPSILON) ||
    (Math.abs(latA - lat) < EDGE_EPSILON && Math.abs(latB - lat) < EDGE_EPSILON)
  );
}

function polygonRings(geometry: ContextFeature['geometry']): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;

  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();

  return [];
}

/** Pierscien bez odcinkow na krawedziach kafli - ciagi linii, ktore zostaja. */
export function ringOutline(closed: readonly Position[]): Position[][] {
  // pierscien zaczynamy zaraz za pierwszym odcinkiem na krawedzi - linia przez punkt startowy nie rwie sie na dwie
  const open = closed.slice(0, -1);
  const cut = open.findIndex((point, index) => onTileEdge(point, open[(index + 1) % open.length] ?? point));
  const start = cut === -1 ? 0 : (cut + 1) % open.length;
  const ring = [...open.slice(start), ...open.slice(0, start), open[start] ?? []];
  const parts: Position[][] = [];
  let current: Position[] = [];

  for (let i = 1; i < ring.length; i += 1) {
    const a = ring[i - 1];
    const b = ring[i];

    if (!a || !b) continue;

    if (onTileEdge(a, b)) {
      if (current.length > 1) parts.push(current);

      current = [];

      continue;
    }

    if (current.length === 0) current.push(a);

    current.push(b);
  }

  if (current.length > 1) parts.push(current);

  return parts;
}

/** Srodek obiektu na znak: punkt, srodkowy wierzcholek linii albo srednia wierzcholkow obrysu. */
export function markPoint(geometry: ContextFeature['geometry']): Position | null {
  if (geometry.type === 'Point') return geometry.coordinates;

  if (geometry.type === 'LineString')
    return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)] ?? null;

  if (geometry.type === 'MultiLineString') {
    const longest = geometry.coordinates.reduce<Position[]>(
      (best, line) => (line.length > best.length ? line : best),
      [],
    );

    return longest[Math.floor(longest.length / 2)] ?? null;
  }

  const ring = polygonRings(geometry)[0] ?? [];
  const points = ring.slice(0, -1);

  if (points.length === 0) return null;

  return [
    points.reduce((sum, [lng = 0]) => sum + lng, 0) / points.length,
    points.reduce((sum, [, lat = 0]) => sum + lat, 0) / points.length,
  ];
}

/**
 * Kolekcje jednej warstwy otoczenia: obiekty (styl po `kind`), obrysy poligonow bez szwow na krawedziach kafli
 * i znaki budowli wodnych z podpisem rodzaju.
 */
export function contextCollections(
  tiles: Iterable<ContextTile>,
  labels: ContextKindLabels = {},
): ContextCollections {
  const features: Feature[] = [];
  const outlines: Feature[] = [];
  const marks: Feature[] = [];

  for (const feature of uniqueFeatures(tiles)) {
    const properties = { kind: feature.kind, name: feature.name ?? '' };

    features.push({ type: 'Feature', properties, geometry: feature.geometry });

    const parts = polygonRings(feature.geometry).flatMap(ringOutline);

    if (parts.length > 0) {
      outlines.push({
        type: 'Feature',
        properties,
        geometry: { type: 'MultiLineString', coordinates: parts },
      });
    }

    if (!STRUCTURE_KINDS.has(feature.kind)) continue;
    const point = markPoint(feature.geometry);

    if (point) {
      marks.push({
        type: 'Feature',
        properties: { ...properties, label: labels[feature.kind] ?? '' },
        geometry: { type: 'Point', coordinates: point },
      });
    }
  }

  return {
    features: { type: 'FeatureCollection', features },
    outlines: { type: 'FeatureCollection', features: outlines },
    marks: { type: 'FeatureCollection', features: marks },
  };
}

function insideRing([lng = 0, lat = 0]: Position, ring: readonly Position[]): boolean {
  let result = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi = 0, yi = 0] = ring[i] ?? [];
    const [xj = 0, yj = 0] = ring[j] ?? [];

    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) result = !result;
  }

  return result;
}

function insidePolygon(point: Position, polygon: readonly Position[][]): boolean {
  const [outer, ...holes] = polygon;

  return !!outer && insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole));
}

function polygons(geometry: ContextFeature['geometry']): Position[][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates];

  if (geometry.type === 'MultiPolygon') return geometry.coordinates;

  return [];
}

type Box = [number, number, number, number];

function ringBox(ring: readonly Position[]): Box {
  return ring.reduce<Box>(
    (box, [lng = 0, lat = 0]) => [
      Math.min(box[0], lng),
      Math.min(box[1], lat),
      Math.max(box[2], lng),
      Math.max(box[3], lat),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

const SAMPLES = 9;

/**
 * Punkt wewnatrz wielokata w prostokacie `box` mozliwie blisko jego srodka i nie blizej niz `gap` od punktow `taken`
 * (podpisy roznych obszarow o podobnym ksztalcie nie laduja jeden na drugim); null = brak takiego punktu.
 */
function pointInside(
  polygon: readonly Position[][],
  box: Box,
  taken: readonly Position[],
  gap: number,
): Position | null {
  const [centerLng, centerLat] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  const free = ([lng = 0, lat = 0]: Position) =>
    taken.every(([lngT = 0, latT = 0]) => Math.hypot(lng - lngT, lat - latT) >= gap);
  const candidates: Position[] = [[centerLng, centerLat]];

  for (let i = 0; i < SAMPLES; i += 1) {
    for (let j = 0; j < SAMPLES; j += 1) {
      candidates.push([
        box[0] + ((i + 0.5) / SAMPLES) * (box[2] - box[0]),
        box[1] + ((j + 0.5) / SAMPLES) * (box[3] - box[1]),
      ]);
    }
  }

  const distance = ([lng = 0, lat = 0]: Position) => Math.hypot(lng - centerLng, lat - centerLat);

  return (
    candidates
      .toSorted((a, b) => distance(a) - distance(b))
      .find((point) => free(point) && insidePolygon(point, polygon)) ?? null
  );
}

/** Slowa, po ktorych widac rodzaj obszaru w samej nazwie ("Biebrzanski Park Narodowy", "Rezerwat Stawy Milickie"). */
const KIND_WORDS = ['park', 'rezerwat', 'natura', 'ostoja', 'obszar'];

/**
 * Jeden podpis na obszar chroniony w widoku `view` ([zachod, poludnie, wschod, polnoc]): obszar to wiele kawalkow
 * o tej samej nazwie (kafle, czesci), wiec punkt podpisu lezy w kawalku, ktory zajmuje najwiecej widoku, mozliwie
 * blisko srodka tej czesci. Rodzaj (z `labels`) idzie w drugim wierszu, chyba ze nazwa juz go mowi.
 */
export function areaLabels(
  tiles: Iterable<ContextTile>,
  view: Box,
  labels: ContextKindLabels = {},
): FeatureCollection {
  const best = new Map<string, { feature: ContextFeature; polygon: Position[][]; box: Box; area: number }>();

  for (const feature of uniqueFeatures(tiles)) {
    if (!feature.name) continue;
    const key = `${feature.kind}|${feature.name}`;

    for (const polygon of polygons(feature.geometry)) {
      const ring = polygon[0];

      if (!ring) continue;
      const [west, south, east, north] = ringBox(ring);
      const box: Box = [
        Math.max(west, view[0]),
        Math.max(south, view[1]),
        Math.min(east, view[2]),
        Math.min(north, view[3]),
      ];
      const area = Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
      const current = best.get(key);

      if (area > 0 && (!current || area > current.area)) best.set(key, { feature, polygon, box, area });
    }
  }

  const features: Feature[] = [];

  const taken: Position[] = [];
  // odstep miedzy podpisami: ok. jedna szosta widoku
  const gap = Math.min(view[2] - view[0], view[3] - view[1]) / 6;

  // najpierw obszary zajmujace najwiecej widoku - one dostaja miejsce najblizej srodka
  for (const { feature, polygon, box } of [...best.values()].toSorted((a, b) => b.area - a.area)) {
    const point = pointInside(polygon, box, taken, gap);
    const name = feature.name ?? '';
    const kind = labels[feature.kind];

    if (!point) continue;

    taken.push(point);
    const saysKind = KIND_WORDS.some((word) => normalizeText(name).includes(word));

    features.push({
      type: 'Feature',
      properties: { kind: feature.kind, label: kind && !saysKind ? `${name}\n${kind}` : name },
      geometry: { type: 'Point', coordinates: point },
    });
  }

  return { type: 'FeatureCollection', features };
}

/** Najnowsza data importu z kafli (do legendy); null = zadnej. */
export function latestContextImport(tiles: Iterable<ContextTile>): string | null {
  let latest: string | null = null;

  for (const tile of tiles) {
    if (tile.importedAt && (latest === null || tile.importedAt > latest)) latest = tile.importedAt;
  }

  return latest;
}
