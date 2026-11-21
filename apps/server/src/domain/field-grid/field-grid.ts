// Siatka komorek pola: kwadraty 10 m w UTM, wyrownane do pikseli Sentinel-2 (narozniki kafli S2 leza na
// wielokrotnosciach 10 i 20 m, wiec raster z Copernicus dla tej siatki to piksele bez przeprobkowania). Duze pola
// dostaja komorki 20, 40 m..., zeby komorek bylo najwyzej MAX_FIELD_CELLS. Tu tylko geometria: ktore komorki leza
// w polu, gdzie sa i jaki maja obrys; cechy komorek i strefy licza domain/zones.
import type { ParcelGeometry } from '@app/contracts';

import { fromUtm, toUtm, utmEpsg, utmZone } from '../utm';

export const BASE_CELL_M = 10;
/** 2000 komorek = 20 ha przy 10 m; wiecej komorek nie zmienia stref, a wydluza obliczenia */
export const MAX_FIELD_CELLS = 5000;
/**
 * Najwiecej wezlow prostokata siatki (10 x 10 km przy 10 m). Dzialki gospodarstwa rozrzucone dalej nie sa jednym
 * polem do podzialu na strefy - etap stref je pomija, a adapter rastra nie pyta o taki obszar.
 */
export const MAX_GRID_NODES = 1_000_000;

/** Czy siatka jest za duza na strefy (czesci pola daleko od siebie). */
export const gridTooLarge = (spec: GridSpec): boolean => spec.cols * spec.rows > MAX_GRID_NODES;

export interface GridSpec {
  zone: number;
  epsg: number;
  /** naroznik polnocno-zachodni siatki w metrach UTM (wielokrotnosc boku komorki) */
  west: number;
  north: number;
  cellSizeM: number;
  cols: number;
  rows: number;
}

export interface GridCell {
  /** wiersz * cols + kolumna */
  index: number;
  row: number;
  col: number;
  /** srodek komorki w metrach UTM */
  easting: number;
  northing: number;
}

type Ring = [number, number][];

function polygonsOf(geometry: ParcelGeometry): Ring[][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function projected(geometry: ParcelGeometry, zone: number): Ring[] {
  return polygonsOf(geometry).flatMap((polygon) =>
    polygon.map((ring) => ring.map(([lng, lat]) => toUtm(lng, lat, zone))),
  );
}

/** Siatka dla pola: strefa UTM srodka pola, prostokat pola rozszerzony do granic komorek. */
export function fieldGrid(geometry: ParcelGeometry, centroidLng: number, areaHa: number): GridSpec {
  const zone = utmZone(centroidLng);
  const points = projected(geometry, zone).flat();
  const eastings = points.map(([easting]) => easting);
  const northings = points.map(([, northing]) => northing);
  let cellSizeM = BASE_CELL_M;

  while ((areaHa * 10_000) / (cellSizeM * cellSizeM) > MAX_FIELD_CELLS) cellSizeM *= 2;

  const west = Math.floor(Math.min(...eastings) / cellSizeM) * cellSizeM;
  const north = Math.ceil(Math.max(...northings) / cellSizeM) * cellSizeM;

  return {
    zone,
    epsg: utmEpsg(zone),
    west,
    north,
    cellSizeM,
    cols: Math.max(1, Math.ceil((Math.max(...eastings) - west) / cellSizeM)),
    rows: Math.max(1, Math.ceil((north - Math.min(...northings)) / cellSizeM)),
  };
}

/** Parzysta liczba przeciec promienia = punkt poza; dziury i wiele czesci obsluguje ta sama regula. */
function inside(polygon: readonly Ring[], x: number, y: number): boolean {
  let result = false;

  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i] ?? [0, 0];
      const [xj, yj] = ring[j] ?? [0, 0];

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
    }
  }

  return result;
}

/** Komorki, ktorych srodek lezy w polu (kazda czesc pola przegladana tylko w swoim prostokacie). */
export function cellsInField(spec: GridSpec, geometry: ParcelGeometry): GridCell[] {
  const found = new Map<number, GridCell>();

  for (const polygon of polygonsOf(geometry)) {
    const projectedRings = polygon.map((ring) => ring.map(([lng, lat]) => toUtm(lng, lat, spec.zone)));
    const points = projectedRings.flat();
    const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
    const colFrom = clamp(
      Math.floor((Math.min(...points.map(([e]) => e)) - spec.west) / spec.cellSizeM),
      spec.cols - 1,
    );
    const colTo = clamp(
      Math.ceil((Math.max(...points.map(([e]) => e)) - spec.west) / spec.cellSizeM),
      spec.cols - 1,
    );
    const rowFrom = clamp(
      Math.floor((spec.north - Math.max(...points.map(([, n]) => n))) / spec.cellSizeM),
      spec.rows - 1,
    );
    const rowTo = clamp(
      Math.ceil((spec.north - Math.min(...points.map(([, n]) => n))) / spec.cellSizeM),
      spec.rows - 1,
    );

    for (let row = rowFrom; row <= rowTo; row += 1) {
      for (let col = colFrom; col <= colTo; col += 1) {
        const easting = spec.west + (col + 0.5) * spec.cellSizeM;
        const northing = spec.north - (row + 0.5) * spec.cellSizeM;
        const index = row * spec.cols + col;

        if (!found.has(index) && inside(projectedRings, easting, northing)) {
          found.set(index, { index, row, col, easting, northing });
        }
      }
    }
  }

  return [...found.values()].toSorted((a, b) => a.index - b.index);
}

const round6 = (value: number): number => Number(value.toFixed(6));

/** Kierunki w ukladzie ekranu (y w dol): prawo, dol, lewo, gora. */
const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

interface Edge {
  from: [number, number];
  to: [number, number];
}

const key = (point: readonly [number, number]): string => `${point[0]},${point[1]}`;

/** Krawedzie brzegu zbioru komorek, zgodnie z ruchem wskazowek zegara (obszar po prawej stronie krawedzi). */
function boundaryEdges(spec: GridSpec, set: ReadonlySet<number>): Edge[] {
  const edges: Edge[] = [];
  const has = (row: number, col: number) =>
    row >= 0 && col >= 0 && row < spec.rows && col < spec.cols && set.has(row * spec.cols + col);

  for (const index of set) {
    const row = Math.floor(index / spec.cols);
    const col = index % spec.cols;

    if (!has(row - 1, col)) edges.push({ from: [col, row], to: [col + 1, row] });

    if (!has(row, col + 1)) edges.push({ from: [col + 1, row], to: [col + 1, row + 1] });

    if (!has(row + 1, col)) edges.push({ from: [col + 1, row + 1], to: [col, row + 1] });

    if (!has(row, col - 1)) edges.push({ from: [col, row + 1], to: [col, row] });
  }

  return edges;
}

const directionOf = (edge: Edge): number =>
  DIRECTIONS.findIndex(([dx, dy]) => edge.to[0] - edge.from[0] === dx && edge.to[1] - edge.from[1] === dy);

/**
 * Laczy krawedzie w pierscienie. W wierzcholku, gdzie komorki stykaja sie tylko rogiem, skrecamy w prawo (do
 * wnetrza obszaru) - komorki styczne narożnikami daja osobne pierscienie, wiec obrys nigdy sie nie przecina.
 */
function rings(edges: readonly Edge[]): [number, number][][] {
  const outgoing = new Map<string, Edge[]>();

  for (const edge of edges) outgoing.set(key(edge.from), [...(outgoing.get(key(edge.from)) ?? []), edge]);

  const used = new Set<Edge>();
  const result: [number, number][][] = [];

  for (const start of edges) {
    if (used.has(start)) continue;

    const ring: [number, number][] = [start.from];
    let edge = start;

    used.add(edge);

    while (key(edge.to) !== key(start.from)) {
      const direction = directionOf(edge);
      const candidates = (outgoing.get(key(edge.to)) ?? []).filter((next) => !used.has(next));
      // prawo, prosto, lewo wzgledem kierunku dojscia
      const preference = [1, 0, 3].map((turn) => (direction + turn) % 4);
      const next =
        preference.map((wanted) => candidates.find((item) => directionOf(item) === wanted)).find(Boolean) ??
        candidates[0];

      if (!next) break;

      // wierzcholek tylko przy zmianie kierunku - proste odcinki brzegu bez punktow posrednich
      if (directionOf(next) !== direction) ring.push(next.from);

      used.add(next);
      edge = next;
    }

    if (directionOf(edge) === directionOf(start)) ring.shift();

    result.push(ring);
  }

  return result;
}

/** Pole powierzchni pierscienia w ukladzie mapy (y w gore): ujemne = zgodnie z ruchem wskazowek zegara. */
function signedArea(ring: readonly [number, number][]): number {
  let sum = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] ?? [0, 0];
    const [x2, y2] = ring[(i + 1) % ring.length] ?? [0, 0];

    sum += x1 * -y2 - x2 * -y1;
  }

  return sum / 2;
}

/**
 * Obrys zbioru komorek jako wielokat GeoJSON w WGS84: pierscienie zewnetrzne przeciwnie do wskazowek zegara,
 * dziury zgodnie (RFC 7946). Komorki styczne tylko rogiem to osobne czesci.
 */
export function cellsOutline(spec: GridSpec, indices: Iterable<number>): ParcelGeometry {
  const all = rings(boundaryEdges(spec, new Set(indices)));
  // brzeg obiegamy zgodnie z zegarem: pierscienie zewnetrzne wychodza ujemne, dziury dodatnie; na koniec odwracamy
  const outer = all.filter((ring) => signedArea(ring) < 0);
  const holes = all.filter((ring) => signedArea(ring) > 0);
  const toLngLat = ([col, row]: [number, number]): [number, number] => {
    const [lng, lat] = fromUtm(
      spec.west + col * spec.cellSizeM,
      spec.north - row * spec.cellSizeM,
      spec.zone,
    );

    return [round6(lng), round6(lat)];
  };
  const closed = (ring: [number, number][]): [number, number][] => {
    const points = ring.map(toLngLat).toReversed();
    const [first] = points;

    if (first) points.push(first);

    return points;
  };
  const polygons = outer.map((ring) => {
    const own = holes.filter((hole) => {
      const [x, y] = hole[0] ?? [0, 0];

      // wierzcholek dziury przesuniety o cwierc komorki - jedno z przesuniec trafia w glab otaczajacego obszaru
      return inside([ring], x + 0.25, y + 0.25) || inside([ring], x - 0.25, y - 0.25);
    });

    return [ring, ...own].map(closed);
  });
  const [single] = polygons;

  return polygons.length === 1 && single
    ? { type: 'Polygon', coordinates: single }
    : { type: 'MultiPolygon', coordinates: polygons };
}

/** Srodek komorki w WGS84. */
export function cellLngLat(spec: GridSpec, cell: Pick<GridCell, 'easting' | 'northing'>): [number, number] {
  return fromUtm(cell.easting, cell.northing, spec.zone);
}
