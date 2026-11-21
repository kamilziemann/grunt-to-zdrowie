// Geometria dzialki bez zaleznosci: parser WKT (odpowiedz ULDK) -> GeoJSON oraz bbox, centroid i powierzchnia.
// Wspolrzedne to WGS84 [dlugosc, szerokosc]. Powierzchnie liczymy w lokalnym rzucie rownopolowym na elipsoidzie
// GRS80 wokol srodka dzialki - dla obiektu wielkosci pola blad jest ponizej 0,01%.
export type Position = [number, number];
export type Ring = Position[];

export type PolygonGeometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

export type BoundingBox = [west: number, south: number, east: number, north: number];

const SEMI_MAJOR_M = 6_378_137;
const ECCENTRICITY_SQ = 0.006_694_380_022_90;
const DEG = Math.PI / 180;

function parseRing(text: string): Ring {
  return text
    .split(',')
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((pair): pair is [number, number] => pair.length >= 2 && pair.every(Number.isFinite))
    .map(([lng, lat]) => [lng, lat]);
}

/** Pierscienie jednego poligonu z tekstu "(x y, x y),(x y, ...)" (zewnetrzny + dziury). */
function parseRings(text: string): Ring[] {
  return [...text.matchAll(/\(([^()]+)\)/g)].map((match) => parseRing(match[1] ?? ''));
}

/** WKT z ULDK: opcjonalny prefiks "SRID=4326;", potem POLYGON albo MULTIPOLYGON. Zly tekst = null. */
export function parseWktPolygon(wkt: string): PolygonGeometry | null {
  const text = wkt.trim().replace(/^SRID=\d+;/i, '');
  const multi = /^MULTIPOLYGON\s*\((.*)\)$/is.exec(text);

  if (multi) {
    const polygons = [...(multi[1] ?? '').matchAll(/\(((?:\s*\([^()]+\)\s*,?)+)\)/g)]
      .map((match) => parseRings(match[1] ?? ''))
      .filter((rings) => isUsable(rings));

    return polygons.length > 0 ? { type: 'MultiPolygon', coordinates: polygons } : null;
  }

  const single = /^POLYGON\s*\((.*)\)$/is.exec(text);

  if (!single) return null;

  const rings = parseRings(single[1] ?? '');

  return isUsable(rings) ? { type: 'Polygon', coordinates: rings } : null;
}

function isUsable(rings: Ring[]): boolean {
  return rings.length > 0 && rings.every((ring) => ring.length >= 4);
}

function polygonsOf(geometry: PolygonGeometry): Ring[][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

export function boundingBox(geometry: PolygonGeometry): BoundingBox {
  const box: BoundingBox = [Infinity, Infinity, -Infinity, -Infinity];

  for (const rings of polygonsOf(geometry)) {
    for (const [lng, lat] of rings[0] ?? []) {
      box[0] = Math.min(box[0], lng);
      box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lng);
      box[3] = Math.max(box[3], lat);
    }
  }

  return box;
}

/** Pole ze znakiem i momenty pierscienia (wzor Gaussa) w podanych jednostkach. */
function ringMoments(ring: Ring): { area: number; cx: number; cy: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i] ?? [0, 0];
    const [x1, y1] = ring[i + 1] ?? [0, 0];
    const cross = x0 * y1 - x1 * y0;

    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  return { area: area / 2, cx: cx / 6, cy: cy / 6 };
}

/** Sumuje pierscienie poligonow: zewnetrzny dodaje pole, dziury odejmuja. Wspolrzedne wzgledem `origin`. */
function totalMoments(geometry: PolygonGeometry, origin: Position, scale: Position) {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (const rings of polygonsOf(geometry)) {
    rings.forEach((ring, index) => {
      const local = ring.map(([lng, lat]): Position => [
        (lng - origin[0]) * scale[0],
        (lat - origin[1]) * scale[1],
      ]);
      const moments = ringMoments(local);
      const sign = (index === 0 ? 1 : -1) * Math.sign(moments.area || 1);

      area += sign * moments.area;
      cx += sign * moments.cx;
      cy += sign * moments.cy;
    });
  }

  return { area, cx, cy };
}

/** Metry na stopien dlugosci i szerokosci geograficznej na elipsoidzie GRS80 dla danej szerokosci. */
function metersPerDegree(latitude: number): Position {
  const sin = Math.sin(latitude * DEG);
  const w = Math.sqrt(1 - ECCENTRICITY_SQ * sin * sin);
  const primeVertical = SEMI_MAJOR_M / w;
  const meridional = (SEMI_MAJOR_M * (1 - ECCENTRICITY_SQ)) / (w * w * w);

  return [primeVertical * Math.cos(latitude * DEG) * DEG, meridional * DEG];
}

function boxCenter(box: BoundingBox): Position {
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

/** Powierzchnia w metrach kwadratowych (dziury odjete). */
export function areaSquareMeters(geometry: PolygonGeometry): number {
  const origin = boxCenter(boundingBox(geometry));

  return Math.abs(totalMoments(geometry, origin, metersPerDegree(origin[1])).area);
}

/** Srodek ciezkosci; dla zdegenerowanej geometrii srodek prostokata otaczajacego. */
export function centroid(geometry: PolygonGeometry): Position {
  const origin = boxCenter(boundingBox(geometry));
  const scale = metersPerDegree(origin[1]);
  const { area, cx, cy } = totalMoments(geometry, origin, scale);

  if (Math.abs(area) < 1e-9) return origin;

  return [origin[0] + cx / area / scale[0], origin[1] + cy / area / scale[1]];
}

function ringContains(ring: Ring, [x, y]: Position): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }

  return inside;
}

/** Czy punkt lezy w geometrii (w pierscieniu zewnetrznym i poza dziurami). */
export function containsPoint(geometry: PolygonGeometry, point: Position): boolean {
  return polygonsOf(geometry).some(
    ([outer, ...holes]) =>
      outer !== undefined && ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point)),
  );
}
