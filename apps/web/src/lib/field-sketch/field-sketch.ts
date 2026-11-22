// Szkic "Pole i woda wokol" bez biblioteki map: rzut lokalny w metrach wokol srodka pola, wybor obiektow BDOT10k
// w promieniu SKETCH_RADIUS_M, sciezki SVG, podzialka, jeden wyrozniony fakt (row przez pole albo najblizszy row
// lub ciek z linia wymiarowa; kazdy osobny row w polu z wlasnym punktem odniesienia) i miejsca na polu (strefy z raportu) z punktem na numer. Sam model - rysuje go
// komponent raportu (`FieldSketch`).
import type { HydroFeature, HydroFeatureKind, ParcelGeometry, Zone } from '@app/contracts';
import type { Position } from 'geojson';

import { distanceM, WATERCOURSE_KINDS } from '@/lib/hydro-map';

/** Promien okolicy pola na szkicu (m). */
export const SKETCH_RADIUS_M = 250;
/** Szerokosc szkicu w jednostkach viewBox; wysokosc wynika z proporcji okolicy pola. */
export const SKETCH_WIDTH = 560;

/** Proporcje szkicu (szerokosc / wysokosc): bez waskich pasow na telefonie i na wydruku. */
const MIN_ASPECT = 0.8;
const MAX_ASPECT = 1.5;
/** Odcinek rowu w polu blizej granicy niz tyle metrow = row na skraju pola. */
const EDGE_M = 15;
/** Konce odcinkow blizej niz tyle metrow = ten sam row (BDOT10k dzieli rowy na odcinki miedzy wezlami). */
const JOIN_M = 1;
/** Kawalek rowu w polu krotszy niz tyle metrow (row zahacza o rog pola) nie dostaje osobnej linii odniesienia. */
const MIN_DITCH_M = 5;
/** Najwiecej linii odniesienia od tabliczki - przy wiekszej liczbie rowow linie ida do najdluzszych. */
export const MAX_ANCHORS = 4;
const NICE_SCALES = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

type Meters = [number, number];

export type SketchPoint = [number, number];

/** Grupy obiektow na szkicu i w legendzie. */
export type SketchGroup = 'ditch' | 'watercourse' | 'canal' | 'water' | 'wetland';

export interface SketchShape {
  group: SketchGroup;
  kind: HydroFeatureKind;
  name: string | null;
  /** sciezka SVG we wspolrzednych viewBox */
  d: string;
}

export interface SketchLabel {
  text: string;
  at: SketchPoint;
}

export type SketchFact =
  | {
      kind: 'ditch_through';
      lengthM: number;
      /** rowy biegna skrajem pola (kazdy row w polu lezy przy granicy), a nie przez jego srodek */
      alongEdge: boolean;
      /** liczba osobnych rowow w polu (odcinki stykajace sie koncami to jeden row) */
      ditches: number;
      /**
       * punkty odniesienia: srodek najdluzszego odcinka kazdego rowu, od najdluzszego rowu, najwyzej MAX_ANCHORS -
       * tu dochodza linie od tabliczki
       */
      anchors: SketchPoint[];
    }
  | {
      kind: 'nearest_ditch' | 'nearest_watercourse';
      distanceM: number;
      featureKind: HydroFeatureKind;
      name: string | null;
      /** linia wymiarowa: punkt na granicy pola -> najblizszy punkt obiektu */
      from: SketchPoint;
      to: SketchPoint;
    };

/** Miejsce na polu (strefa z raportu) we wspolrzednych viewBox. */
export interface SketchZone {
  id: string;
  /** sciezka SVG: obrys strefy (pierscienie, evenodd) albo linia (linia splywu) */
  d: string;
  line: boolean;
  /** punkt na numer strefy: w glebi najwiekszej czesci strefy (najdalej od jej brzegow), dla linii - jej srodek */
  labelAt: SketchPoint;
}

export interface FieldSketchModel {
  width: number;
  height: number;
  /** obrys pola (wiele pierscieni, wypelnienie evenodd) */
  field: string;
  /** punkt podpisu pola (srodek prostokata pola) */
  fieldCenter: SketchPoint;
  /** szerokosc i wysokosc prostokata pola w jednostkach viewBox */
  fieldSize: SketchPoint;
  lines: SketchShape[];
  areas: SketchShape[];
  /** czesc rowu w polu albo najblizszy obiekt - rysowane grubiej */
  highlight: string | null;
  fact: SketchFact | null;
  /** nazwy ciekow przy linii (raz na nazwe) */
  names: SketchLabel[];
  groups: SketchGroup[];
  scale: { meters: number; length: number };
  /** miejsca na polu w kolejnosci z raportu */
  zones: SketchZone[];
}

/** Rzut rownoodlegosciowy wokol punktu: [metry na wschod, metry na polnoc]; na kilka kilometrow wystarczy. */
export function localProjection(origin: Position): (point: Position) => Meters {
  const [lng0 = 0, lat0 = 0] = origin;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110_540;

  return ([lng = 0, lat = 0]) => [(lng - lng0) * kx, (lat - lat0) * ky];
}

export function sketchGroup(kind: HydroFeatureKind): SketchGroup {
  if (kind === 'ditch') return 'ditch';

  if (kind === 'canal') return 'canal';

  if (WATERCOURSE_KINDS.has(kind) && kind !== 'flowing_water') return 'watercourse';

  if (kind === 'wetland' || kind === 'bog') return 'wetland';

  return 'water';
}

/** Ciagi punktow geometrii: linie wprost, poligony - kazdy pierscien. */
function paths(geometry: HydroFeature['geometry'] | ParcelGeometry): Position[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates];

  if (geometry.type === 'MultiLineString') return geometry.coordinates;

  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();

  return geometry.coordinates;
}

function isLine(geometry: HydroFeature['geometry']): boolean {
  return geometry.type === 'LineString' || geometry.type === 'MultiLineString';
}

/** Punkt w polu: parzysta liczba przeciec ze wszystkimi pierscieniami (dziury i kilka czesci dzialaja same). */
export function insideRings(point: Meters, rings: readonly Meters[][]): boolean {
  let result = false;

  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi = 0, yi = 0] = ring[i] ?? [];
      const [xj = 0, yj = 0] = ring[j] ?? [];

      if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
        result = !result;
      }
    }
  }

  return result;
}

/** Parametr t (0..1) przeciecia odcinka a-b z odcinkiem c-d albo null. */
function crossingT(a: Meters, b: Meters, c: Meters, d: Meters): number | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const denominator = rx * sy - ry * sx;

  if (denominator === 0) return null;
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / denominator;
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / denominator;

  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}

function lerp(a: Meters, b: Meters, t: number): Meters {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Odcinki linii lezace w polu (linia ciecia na granicach pola). */
export function clipToField(line: readonly Meters[], rings: readonly Meters[][]): Meters[][] {
  const pieces: Meters[][] = [];
  let current: Meters[] = [];

  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];

    if (!a || !b) continue;
    const cuts = [0, 1];

    for (const ring of rings) {
      for (let j = 1; j < ring.length; j += 1) {
        const c = ring[j - 1];
        const d = ring[j];
        const t = c && d ? crossingT(a, b, c, d) : null;

        if (t !== null) cuts.push(t);
      }
    }

    cuts.sort((x, y) => x - y);

    for (let k = 1; k < cuts.length; k += 1) {
      const t0 = cuts[k - 1] ?? 0;
      const t1 = cuts[k] ?? 1;

      if (t1 - t0 < 1e-9) continue;
      const start = lerp(a, b, t0);
      const end = lerp(a, b, t1);

      if (insideRings(lerp(a, b, (t0 + t1) / 2), rings)) {
        if (current.length === 0) current.push(start);
        current.push(end);
      } else if (current.length > 0) {
        pieces.push(current);
        current = [];
      }
    }
  }

  if (current.length > 0) pieces.push(current);

  return pieces;
}

function pathLength(points: readonly Meters[]): number {
  let length = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];

    if (a && b) length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  return length;
}

/** Punkt w polowie dlugosci linii. */
function midpoint(points: readonly Meters[]): Meters {
  let left = pathLength(points) / 2;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];

    if (!a || !b) continue;
    const step = Math.hypot(b[0] - a[0], b[1] - a[1]);

    if (step >= left) return step === 0 ? a : lerp(a, b, left / step);

    left -= step;
  }

  return points[0] ?? [0, 0];
}

function closestOnSegment(p: Meters, a: Meters, b: Meters): Meters {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));

  return [a[0] + t * dx, a[1] + t * dy];
}

/** Najblizsza para punktow [na polu, na obiekcie] miedzy dwoma zbiorami linii. */
export function closestPair(
  field: readonly Meters[][],
  other: readonly Meters[][],
): { from: Meters; to: Meters; distance: number } {
  let best = { from: [0, 0] as Meters, to: [0, 0] as Meters, distance: Infinity };

  for (const [points, targets, fieldSide] of [
    [field, other, true],
    [other, field, false],
  ] as const) {
    for (const path of points) {
      for (const point of path) {
        for (const target of targets) {
          for (let i = 1; i < target.length; i += 1) {
            const a = target[i - 1];
            const b = target[i];

            if (!a || !b) continue;
            const hit = closestOnSegment(point, a, b);
            const distance = Math.hypot(hit[0] - point[0], hit[1] - point[1]);

            if (distance < best.distance) {
              best = fieldSide ? { from: point, to: hit, distance } : { from: hit, to: point, distance };
            }
          }
        }
      }
    }
  }

  return best;
}

/** Ladna dlugosc podzialki: najwieksza z listy, ktora miesci sie w ok. 1/4 szerokosci szkicu. */
export function niceScale(widthM: number): number {
  const target = widthM / 4;

  return NICE_SCALES.findLast((value) => value <= target) ?? NICE_SCALES[0] ?? 10;
}

/** Pole powierzchni pierscienia (wzor Gaussa, wartosc bezwzgledna). */
function ringArea(ring: readonly Meters[]): number {
  let sum = 0;

  for (let i = 1; i < ring.length; i += 1) {
    const [x0 = 0, y0 = 0] = ring[i - 1] ?? [];
    const [x1 = 0, y1 = 0] = ring[i] ?? [];

    sum += x0 * y1 - x1 * y0;
  }

  return Math.abs(sum) / 2;
}

/** Odleglosc punktu od najblizszego brzegu (wszystkie pierscienie). */
function edgeDistance(point: Meters, rings: readonly Meters[][]): number {
  let best = Infinity;

  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const a = ring[i - 1];
      const b = ring[i];

      if (!a || !b) continue;
      const hit = closestOnSegment(point, a, b);

      best = Math.min(best, Math.hypot(hit[0] - point[0], hit[1] - point[1]));
    }
  }

  return best;
}

/** Siatka probek przy szukaniu miejsca na numer strefy - 24 x 24 wystarcza na wielokaty z siatki 10 m. */
const LABEL_GRID = 24;

/**
 * Punkt na numer w wielokacie: z siatki probek w prostokacie najwiekszej czesci wybiera punkt w srodku najdalej od
 * brzegow (przyblizenie "bieguna niedostepnosci") - srodek ciezkosci litery C lezalby poza nia.
 */
export function labelPoint(parts: readonly Meters[][][]): Meters {
  const largest = parts.reduce<Meters[][] | null>(
    (best, rings) => (!best || ringArea(rings[0] ?? []) > ringArea(best[0] ?? []) ? rings : best),
    null,
  );
  const outer = largest?.[0] ?? [];

  if (!largest || outer.length === 0) return [0, 0];
  const xs = outer.map((point) => point[0]);
  const ys = outer.map((point) => point[1]);
  const [minX, minY, maxX, maxY] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  let best: { point: Meters; distance: number } | null = null;

  for (let i = 0; i < LABEL_GRID; i += 1) {
    for (let j = 0; j < LABEL_GRID; j += 1) {
      const point: Meters = [
        minX + ((i + 0.5) / LABEL_GRID) * (maxX - minX),
        minY + ((j + 0.5) / LABEL_GRID) * (maxY - minY),
      ];

      if (!insideRings(point, largest)) continue;
      const distance = edgeDistance(point, largest);

      if (!best || distance > best.distance) best = { point, distance };
    }
  }

  if (best) return best.point;

  // czesc wezsza niz krok siatki: srednia wierzcholkow obrysu
  return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
}

/**
 * Odcinki rowow w polu pogrupowane w osobne rowy: odcinki, ktorych konce stykaja sie (blizej niz JOIN_M), to jeden
 * row. Grupy od najdluzszej.
 */
export function groupDitches(pieces: readonly Meters[][]): { pieces: Meters[][]; length: number }[] {
  const parent = pieces.map((_, index) => index);
  const root = (index: number): number => {
    let current = index;

    while (parent[current] !== current) current = parent[current] ?? current;

    return current;
  };
  const ends = pieces.map((piece) =>
    [piece[0], piece.at(-1)].filter((point): point is Meters => point !== undefined),
  );

  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const touches = (ends[i] ?? []).some((a) =>
        (ends[j] ?? []).some((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < JOIN_M),
      );

      if (touches) parent[root(j)] = root(i);
    }
  }

  const groups = new Map<number, Meters[][]>();

  pieces.forEach((piece, index) => {
    const key = root(index);

    groups.set(key, [...(groups.get(key) ?? []), piece]);
  });

  return [...groups.values()]
    .map((group) => ({ pieces: group, length: group.reduce((sum, piece) => sum + pathLength(piece), 0) }))
    .toSorted((a, b) => b.length - a.length);
}

function featureKey(feature: HydroFeature): string {
  return `${feature.kind}|${JSON.stringify(feature.geometry.coordinates)}`;
}

export interface FieldSketchOptions {
  /** dlugosc rowow w polu z raportu (silnik) - szkic podaje te sama liczbe co przyczyny */
  ditchInFieldM?: number | null;
  radiusM?: number;
  /** miejsca na polu z raportu (`report.zones.zones`) */
  zones?: readonly Pick<Zone, 'id' | 'geometry'>[];
}

/**
 * Model szkicu: obiekty hydrografii w promieniu `radiusM` od pola (kazdy raz, nawet gdy przyszedl w dwoch kaflach),
 * widok = pole + promien (proporcje w granicach MIN_ASPECT..MAX_ASPECT), wspolrzedne viewBox z polnoca u gory.
 */
export function buildFieldSketch(
  geometry: ParcelGeometry,
  centroid: Position,
  features: readonly HydroFeature[],
  { ditchInFieldM = null, radiusM = SKETCH_RADIUS_M, zones = [] }: FieldSketchOptions = {},
): FieldSketchModel {
  const project = localProjection(centroid);
  const rings = paths(geometry).map((ring) => ring.map(project));
  const xs = rings.flat().map((point) => point[0]);
  const ys = rings.flat().map((point) => point[1]);
  const fieldBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  let [minX, minY, maxX, maxY] = [
    fieldBox[0] - radiusM,
    fieldBox[1] - radiusM,
    fieldBox[2] + radiusM,
    fieldBox[3] + radiusM,
  ];
  const aspect = (maxX - minX) / (maxY - minY);

  if (aspect < MIN_ASPECT) {
    const grow = ((maxY - minY) * MIN_ASPECT - (maxX - minX)) / 2;

    minX -= grow;
    maxX += grow;
  } else if (aspect > MAX_ASPECT) {
    const grow = ((maxX - minX) / MAX_ASPECT - (maxY - minY)) / 2;

    minY -= grow;
    maxY += grow;
  }

  const k = SKETCH_WIDTH / (maxX - minX);
  const toSvg = ([x, y]: Meters): SketchPoint => [(x - minX) * k, (maxY - y) * k];
  const d = (path: readonly Meters[], close: boolean) =>
    path
      .map((point, index) => {
        const [x, y] = toSvg(point);

        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join('') + (close ? 'Z' : '');
  const inView = ([x, y]: Meters) => x >= minX && x <= maxX && y >= minY && y <= maxY;

  const seen = new Set<string>();
  const lines: SketchShape[] = [];
  const areas: SketchShape[] = [];
  const groups = new Set<SketchGroup>();
  const names = new Map<string, { length: number; at: Meters }>();
  const insidePieces: Meters[][] = [];
  let nearestDitch: { feature: HydroFeature; distance: number } | null = null;
  let nearestWatercourse: { feature: HydroFeature; distance: number } | null = null;

  for (const feature of features) {
    const key = featureKey(feature);

    if (seen.has(key)) continue;

    seen.add(key);
    const distance = distanceM(geometry, feature.geometry, project);

    if (distance > radiusM) continue;
    const group = sketchGroup(feature.kind);
    const projected = paths(feature.geometry).map((path) => path.map(project));
    const line = isLine(feature.geometry);
    const shape: SketchShape = {
      group,
      kind: feature.kind,
      name: feature.name,
      d: projected.map((path) => d(path, !line)).join(''),
    };

    groups.add(group);
    (line ? lines : areas).push(shape);

    if (feature.kind === 'ditch') {
      for (const path of projected) insidePieces.push(...clipToField(path, rings));

      if (!nearestDitch || distance < nearestDitch.distance) nearestDitch = { feature, distance };
    } else if (line) {
      if (!nearestWatercourse || distance < nearestWatercourse.distance) {
        nearestWatercourse = { feature, distance };
      }
    }

    // nazwa cieku raz, przy najdluzszym odcinku w widoku
    if (line && feature.name && feature.kind !== 'ditch') {
      for (const path of projected) {
        const visible = path.filter(inView);
        const length = pathLength(visible);
        const previous = names.get(feature.name);

        if (visible.length >= 2 && (!previous || length > previous.length)) {
          names.set(feature.name, { length, at: midpoint(visible) });
        }
      }
    }
  }

  const insideLength = insidePieces.reduce((sum, piece) => sum + pathLength(piece), 0);
  let fact: SketchFact | null = null;
  let highlight: string | null = null;

  if (insideLength >= 1) {
    const all = groupDitches(insidePieces);
    // okruchy przy rogu pola nie licza sie jako osobny row, chyba ze innego nie ma
    const ditches = all.filter((group, index) => index === 0 || group.length >= MIN_DITCH_M);
    const anchors = ditches.map((group) =>
      midpoint(group.pieces.reduce((best, piece) => (pathLength(piece) > pathLength(best) ? piece : best))),
    );

    fact = {
      kind: 'ditch_through',
      lengthM: Math.round(ditchInFieldM ?? insideLength),
      alongEdge: anchors.every((anchor) => closestPair([[anchor]], rings).distance < EDGE_M),
      ditches: ditches.length,
      anchors: anchors.slice(0, MAX_ANCHORS).map(toSvg),
    };
    highlight = insidePieces.map((piece) => d(piece, false)).join('');
  } else {
    const nearest = nearestDitch ?? nearestWatercourse;

    if (nearest) {
      const pair = closestPair(
        rings,
        paths(nearest.feature.geometry).map((path) => path.map(project)),
      );

      fact = {
        kind: nearestDitch ? 'nearest_ditch' : 'nearest_watercourse',
        distanceM: Math.round(nearest.distance),
        featureKind: nearest.feature.kind,
        name: nearest.feature.name,
        from: toSvg(pair.from),
        to: toSvg(pair.to),
      };
      highlight = paths(nearest.feature.geometry)
        .map((path) => d(path.map(project), false))
        .join('');
    }
  }

  const meters = niceScale(maxX - minX);
  const sketchZones = zones.map((zone): SketchZone => {
    const shape = zone.geometry;

    if (shape.type === 'LineString') {
      const line = shape.coordinates.map(project);

      return { id: zone.id, d: d(line, false), line: true, labelAt: toSvg(midpoint(line)) };
    }

    const parts = (shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates).map((part) =>
      part.map((ring) => ring.map(project)),
    );

    return {
      id: zone.id,
      d: parts
        .flat()
        .map((ring) => d(ring, true))
        .join(''),
      line: false,
      labelAt: toSvg(labelPoint(parts)),
    };
  });

  return {
    width: SKETCH_WIDTH,
    height: Math.round((maxY - minY) * k),
    field: rings.map((ring) => d(ring, true)).join(''),
    fieldCenter: toSvg([(fieldBox[0] + fieldBox[2]) / 2, (fieldBox[1] + fieldBox[3]) / 2]),
    fieldSize: [(fieldBox[2] - fieldBox[0]) * k, (fieldBox[3] - fieldBox[1]) * k],
    lines,
    areas,
    highlight,
    fact,
    names: [...names].map(([text, { at }]) => ({ text, at: toSvg(at) })),
    groups: [...groups],
    scale: { meters, length: meters * k },
    zones: sketchZones,
  };
}
