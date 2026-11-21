// Geometria wlasnego pola (D3) liczona w przegladarce bez ciezkich bibliotek: pole powierzchni, podzial poligonu
// linia, sprawdzenie, czy obrys sam sie nie przecina, i zwarty zapis obrysu w adresie strony (raport otwiera sie
// z linku). Wspolrzedne [dlugosc, szerokosc] w stopniach; pole liczymy w lokalnym rzucie rownoodleglosciowym, co
// dla obszaru wielkosci pola daje blad ponizej promila.
import type { ParcelGeometry } from '@app/contracts';

export type Position = [number, number];

/** Granice obrysu: liczba wierzcholkow trzyma adres strony w rozsadnej dlugosci (ok. 3-6 znakow na punkt). */
export const FIELD_LIMITS = { minVertices: 3, maxVertices: 60 } as const;

const EARTH_RADIUS_M = 6_371_008.8;
const SQUARE_METERS_PER_HECTARE = 10_000;
const DEGREE = Math.PI / 180;

/** Obrys otwarty (bez powtorzonego pierwszego punktu na koncu). */
function openRing(ring: readonly Position[]): Position[] {
  const first = ring[0];
  const last = ring.at(-1);

  if (ring.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }

  return [...ring];
}

/** Obrys zamkniety (pierwszy punkt powtorzony na koncu) - tak wymaga GeoJSON. */
export function closeRing(ring: readonly Position[]): Position[] {
  const open = openRing(ring);
  const first = open[0];

  return first ? [...open, first] : [];
}

/** Pole obrysu w m2 (wartosc bezwzgledna, kierunek obiegu bez znaczenia). */
export function ringAreaM2(ring: readonly Position[]): number {
  const points = openRing(ring);

  if (points.length < FIELD_LIMITS.minVertices) return 0;
  const latitude = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const scaleX = Math.cos(latitude * DEGREE) * DEGREE * EARTH_RADIUS_M;
  const scaleY = DEGREE * EARTH_RADIUS_M;
  let twice = 0;

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length] ?? point;

    twice += point[0] * scaleX * (next[1] * scaleY) - next[0] * scaleX * (point[1] * scaleY);
  });

  return Math.abs(twice) / 2;
}

/** Pole geometrii dzialki w ha: obrysy zewnetrzne minus dziury. */
export function geometryAreaHa(geometry: ParcelGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const squareMeters = polygons.reduce(
    (sum, [outer = [], ...holes]) =>
      sum + ringAreaM2(outer) - holes.reduce((holeSum, hole) => holeSum + ringAreaM2(hole), 0),
    0,
  );

  return squareMeters / SQUARE_METERS_PER_HECTARE;
}

/** Obrys zewnetrzny do podzialu: poligon albo najwiekszy z wielopoligonu (dziury pomijamy). */
export function outerRing(geometry: ParcelGeometry): Position[] | null {
  const outers =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((polygon) => polygon[0]);
  const rings = outers.filter((ring): ring is Position[] => ring !== undefined && ring.length >= 3);

  if (rings.length === 0) return null;

  return openRing(rings.reduce((best, ring) => (ringAreaM2(ring) > ringAreaM2(best) ? ring : best)));
}

/** Poligon GeoJSON z punktow obrysu (otwartych albo zamknietych). */
export function ringGeometry(ring: readonly Position[]): ParcelGeometry {
  return { type: 'Polygon', coordinates: [closeRing(ring)] };
}

function cross(origin: Position, a: Position, b: Position): number {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

function segmentsCross(a: Position, b: Position, c: Position, d: Position): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Obrys bez samoprzeciec (krawedzie niesasiednie sie nie krzyzuja) - inaczej pole i analiza nie maja sensu. */
export function isSimpleRing(ring: readonly Position[]): boolean {
  const points = openRing(ring);
  const count = points.length;

  if (count < FIELD_LIMITS.minVertices) return false;

  for (let i = 0; i < count; i++) {
    for (let j = i + 2; j < count; j++) {
      // pierwsza i ostatnia krawedz sa sasiednie
      if (i === 0 && j === count - 1) continue;
      const a = points[i];
      const b = points[(i + 1) % count];
      const c = points[j];
      const d = points[(j + 1) % count];

      if (a && b && c && d && segmentsCross(a, b, c, d)) return false;
    }
  }

  return true;
}

/** Czesc obrysu po jednej stronie prostej (algorytm Sutherlanda-Hodgmana dla polplaszczyzny). */
function clipHalfPlane(points: readonly Position[], a: Position, b: Position, sign: 1 | -1): Position[] {
  const result: Position[] = [];

  points.forEach((current, index) => {
    const next = points[(index + 1) % points.length] ?? current;
    const sideCurrent = sign * cross(a, b, current);
    const sideNext = sign * cross(a, b, next);

    if (sideCurrent >= 0) result.push(current);

    if ((sideCurrent > 0 && sideNext < 0) || (sideCurrent < 0 && sideNext > 0)) {
      const share = sideCurrent / (sideCurrent - sideNext);

      result.push([current[0] + (next[0] - current[0]) * share, current[1] + (next[1] - current[1]) * share]);
    }
  });

  return result;
}

/**
 * Podzial obrysu prosta przez punkty `a` i `b` (dwa stukniecia na mapie) na dwie czesci: po lewej i po prawej.
 * Dla dzialki wkleslej czesc moze skladac sie z kilku kawalkow polaczonych odcinkiem na linii podzialu (pole
 * powierzchni pozostaje poprawne). Null = linia nie przecina obrysu albo punkty sa za blisko siebie.
 */
export function splitByLine(
  ring: readonly Position[],
  a: Position,
  b: Position,
): [Position[], Position[]] | null {
  const points = openRing(ring);

  if (points.length < FIELD_LIMITS.minVertices || (a[0] === b[0] && a[1] === b[1])) return null;
  const left = clipHalfPlane(points, a, b, 1);
  const right = clipHalfPlane(points, a, b, -1);
  // kawalek mniejszy niz 1 m2 to nie podzial, tylko linia styczna do obrysu
  const minimum = 1;

  if (ringAreaM2(left) < minimum || ringAreaM2(right) < minimum) return null;

  return [left, right];
}

/** Ramka [zachod, poludnie, wschod, polnoc] obrysu. */
export function ringBbox(ring: readonly Position[]): [number, number, number, number] {
  const lngs = ring.map((point) => point[0]);
  const lats = ring.map((point) => point[1]);

  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

// --- zapis w adresie: stopnie * 1e5 (ok. 1 m), roznice kolejnych punktow, liczby zygzakiem w znakach base64url
// po 5 bitow (szosty bit = "dalej"). Ten sam pomysl co "encoded polyline" Google, ale bez znakow wymagajacych
// kodowania w adresie.
const PRECISION = 1e5;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CONTINUE = 32;

function encodeNumber(value: number): string {
  let rest = value < 0 ? -value * 2 - 1 : value * 2;
  let out = '';

  while (rest >= CONTINUE) {
    out += ALPHABET[(rest % CONTINUE) + CONTINUE];
    rest = Math.floor(rest / CONTINUE);
  }

  return out + ALPHABET[rest];
}

/** Obrys jako krotki napis do parametru adresu (`obszar=`). */
export function encodeRing(ring: readonly Position[]): string {
  let previous: Position = [0, 0];
  let out = '';

  for (const point of openRing(ring)) {
    const scaled: Position = [Math.round(point[0] * PRECISION), Math.round(point[1] * PRECISION)];

    out += encodeNumber(scaled[0] - previous[0]) + encodeNumber(scaled[1] - previous[1]);
    previous = scaled;
  }

  return out;
}

/** Obrys z parametru adresu; null = napis uszkodzony, za malo/za duzo punktow albo wspolrzedne poza zakresem. */
export function decodeRing(text: string): Position[] | null {
  const numbers: number[] = [];
  let value = 0;
  let factor = 1;

  for (const char of text) {
    const digit = ALPHABET.indexOf(char);

    if (digit < 0) return null;
    value += (digit % CONTINUE) * factor;

    if (digit >= CONTINUE) {
      factor *= CONTINUE;

      if (factor > 2 ** 40) return null;

      continue;
    }

    numbers.push(value % 2 === 1 ? -(value + 1) / 2 : value / 2);
    value = 0;
    factor = 1;
  }

  if (factor !== 1 || numbers.length % 2 !== 0) return null;
  const points: Position[] = [];
  let lng = 0;
  let lat = 0;

  for (let index = 0; index < numbers.length; index += 2) {
    lng += numbers[index] ?? 0;
    lat += numbers[index + 1] ?? 0;
    points.push([lng / PRECISION, lat / PRECISION]);
  }

  const valid =
    points.length >= FIELD_LIMITS.minVertices &&
    points.length <= FIELD_LIMITS.maxVertices &&
    points.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);

  return valid ? points : null;
}
