// Pole z kilku sasiednich dzialek jako jeden wielokat do jednego zapytania o obraz: dzialki z ULDK maja wspolne
// granice z tymi samymi wierzcholkami, wiec suma = krawedzie bez par biegnacych w przeciwne strony (wspolna
// granica), polaczone w pierscienie. Bez biblioteki geometrii - gdy cos sie nie sklada (wierzcholek tylko po jednej
// stronie granicy, dziury, styk w punkcie), wynik to null, a serwis pyta o kazda dzialke osobno jak dotad.
import type { PolygonGeometry, Position, Ring } from '../../domain/parcel-geometry';

/** Wierzcholki traktujemy jako wspolne, gdy roznia sie mniej niz ok. 1 cm (zapis ULDK ma 6-7 miejsc po przecinku). */
const PRECISION = 7;

function key([lng, lat]: Position): string {
  return `${lng.toFixed(PRECISION)},${lat.toFixed(PRECISION)}`;
}

/** Pole ze znakiem (wzor Gaussa): dodatnie = pierscien przeciwnie do ruchu wskazowek zegara. */
export function signedArea(ring: Ring): number {
  let sum = 0;

  for (let index = 1; index < ring.length; index += 1) {
    const [x1, y1] = ring[index - 1] ?? [0, 0];
    const [x2, y2] = ring[index] ?? [0, 0];

    sum += x1 * y2 - x2 * y1;
  }

  return sum / 2;
}

function closed(ring: Ring): Ring {
  const first = ring[0];
  const last = ring.at(-1);

  return first && last && key(first) === key(last) ? ring : [...ring, ...(first ? [first] : [])];
}

/** Zewnetrzne pierscienie dzialek przeciwnie do zegara; null = dzialka z dziura albo z kilku czesci. */
function outerRings(parts: readonly PolygonGeometry[]): Ring[] | null {
  const rings: Ring[] = [];

  for (const part of parts) {
    if (part.type !== 'Polygon' || part.coordinates.length !== 1) return null;

    const ring = closed(part.coordinates[0] ?? []);

    rings.push(signedArea(ring) < 0 ? ring.toReversed() : ring);
  }

  return rings;
}

/**
 * Suma sasiednich dzialek: jeden wielokat (moze miec dziure, gdy dzialki otaczaja cudza) albo kilka rozlacznych
 * czesci. null = nie da sie zlozyc bez ryzyka (wtedy obraz powstaje osobno dla kazdej dzialki).
 */
export function mergeParcels(parts: readonly PolygonGeometry[]): PolygonGeometry | null {
  const rings = outerRings(parts);

  if (!rings || rings.length === 0) return null;

  if (rings.length === 1) return { type: 'Polygon', coordinates: rings };

  const edges = new Map<string, { from: Position; to: Position }>();

  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      const from = ring[index - 1];
      const to = ring[index];

      if (!from || !to || key(from) === key(to)) continue;

      const reverse = `${key(to)}>${key(from)}`;

      // wspolna granica dwoch dzialek: ta sama krawedz w przeciwnych kierunkach - znika z sumy
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${key(from)}>${key(to)}`, { from, to });
    }
  }

  const next = new Map<string, { from: Position; to: Position }>();

  for (const edge of edges.values()) {
    // dwie krawedzie z jednego wierzcholka = styk w punkcie albo niespojna granica - nie zgadujemy
    if (next.has(key(edge.from))) return null;

    next.set(key(edge.from), edge);
  }

  const result: Ring[] = [];

  while (next.size > 0) {
    const [startKey, start] = next.entries().next().value ?? [];

    if (!startKey || !start) break;

    const ring: Ring = [start.from];
    let current = start;

    next.delete(startKey);

    for (;;) {
      ring.push(current.to);

      const following = next.get(key(current.to));

      if (key(current.to) === startKey) break;

      if (!following) return null;

      next.delete(key(current.to));
      current = following;
    }

    result.push(ring);
  }

  const outers = result.filter((ring) => signedArea(ring) > 0);
  const holes = result.filter((ring) => signedArea(ring) < 0);

  if (outers.length === 1 && outers[0]) return { type: 'Polygon', coordinates: [outers[0], ...holes] };

  return holes.length === 0 ? { type: 'MultiPolygon', coordinates: outers.map((ring) => [ring]) } : null;
}
