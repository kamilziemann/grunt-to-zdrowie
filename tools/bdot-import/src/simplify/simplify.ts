// Upraszczanie linii i pierscieni (Douglas-Peucker) w ukladzie metrycznym. Po co: hydrografia sluzy do liczenia
// odleglosci od pola z dokladnoscia kilku metrow, a prostsze geometrie to mniejsza baza i szybsze zapytania.
export type Position = readonly [x: number, y: number];

function distanceToSegment(point: Position, start: Position, end: Position): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  // odcinek zerowej dlugosci (zamkniety pierscien: poczatek = koniec) -> odleglosc od punktu
  const along =
    lengthSquared === 0 ? 0 : ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, along));

  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

/** Linia z punktami, ktore odstaja od uproszczonego przebiegu o wiecej niz `toleranceM`; konce zostaja. */
export function simplifyLine(points: readonly Position[], toleranceM: number): Position[] {
  if (points.length < 3 || toleranceM <= 0) return [...points];

  const keep = new Uint8Array(points.length);
  const stack: [from: number, to: number][] = [[0, points.length - 1]];

  keep[0] = 1;
  keep[points.length - 1] = 1;

  for (let range = stack.pop(); range !== undefined; range = stack.pop()) {
    const [from, to] = range;
    const start = points[from];
    const end = points[to];
    let farthest = -1;
    let maxDistance = toleranceM;

    if (start === undefined || end === undefined) continue;

    for (let index = from + 1; index < to; index += 1) {
      const point = points[index];
      const distance = point === undefined ? 0 : distanceToSegment(point, start, end);

      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = index;
      }
    }

    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([from, farthest], [farthest, to]);
    }
  }

  return points.filter((_point, index) => keep[index] === 1);
}

/** Pierscien poligonu (pierwszy punkt = ostatni). Gdyby uproszczenie go zdegenerowalo, zostaje oryginal. */
export function simplifyRing(ring: readonly Position[], toleranceM: number): Position[] {
  const simplified = simplifyLine(ring, toleranceM);

  return simplified.length >= 4 ? simplified : [...ring];
}
