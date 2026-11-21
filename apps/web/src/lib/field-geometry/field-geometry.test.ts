import { describe, expect, it } from 'vitest';

import {
  closeRing,
  decodeRing,
  encodeRing,
  FIELD_LIMITS,
  geometryAreaHa,
  isSimpleRing,
  outerRing,
  ringAreaM2,
  splitByLine,
  type Position,
} from './field-geometry';

// kwadrat ok. 100 x 100 m przy 52 N: 1 m szerokosci geograficznej = 1/111195 stopnia
const LAT = 52.17;
const DLAT = 100 / 111_195;
const DLNG = DLAT / Math.cos((LAT * Math.PI) / 180);
const SQUARE: Position[] = [
  [21.5, LAT],
  [21.5 + DLNG, LAT],
  [21.5 + DLNG, LAT + DLAT],
  [21.5, LAT + DLAT],
];

describe('geometria wlasnego pola', () => {
  it('pole kwadratu 100 x 100 m = 1 ha, bez wzgledu na kierunek i zamkniecie obrysu', () => {
    expect(ringAreaM2(SQUARE)).toBeCloseTo(10_000, -1);
    expect(ringAreaM2(closeRing(SQUARE).toReversed())).toBeCloseTo(10_000, -1);
    expect(geometryAreaHa({ type: 'Polygon', coordinates: [closeRing(SQUARE)] })).toBeCloseTo(1, 2);
  });

  it('dziura odejmuje sie od pola, wielopoligon sumuje', () => {
    const hole: Position[] = SQUARE.map(([x, y]) => [21.5 + (x - 21.5) / 2, LAT + (y - LAT) / 2]);

    expect(
      geometryAreaHa({ type: 'Polygon', coordinates: [closeRing(SQUARE), closeRing(hole)] }),
    ).toBeCloseTo(0.75, 2);
    expect(
      geometryAreaHa({ type: 'MultiPolygon', coordinates: [[closeRing(SQUARE)], [closeRing(hole)]] }),
    ).toBeCloseTo(1.25, 2);
    expect(
      outerRing({ type: 'MultiPolygon', coordinates: [[closeRing(hole)], [closeRing(SQUARE)]] }),
    ).toEqual(SQUARE);
  });

  it('linia przez srodek dzieli kwadrat na dwie polowy', () => {
    const middle = 21.5 + DLNG / 2;
    const parts = splitByLine(SQUARE, [middle, LAT - DLAT], [middle, LAT + 2 * DLAT]);

    expect(parts).not.toBeNull();
    expect(ringAreaM2(parts?.[0] ?? [])).toBeCloseTo(5_000, -1);
    expect(ringAreaM2(parts?.[1] ?? [])).toBeCloseTo(5_000, -1);
  });

  it('linia ukosna: czesci sumuja sie do calosci; linia obok pola = brak podzialu', () => {
    const parts = splitByLine(SQUARE, [21.5, LAT], [21.5 + DLNG * 3, LAT + DLAT]);

    expect((ringAreaM2(parts?.[0] ?? []) + ringAreaM2(parts?.[1] ?? [])) / 10_000).toBeCloseTo(1, 3);
    expect(splitByLine(SQUARE, [21.4, LAT - 1], [21.4, LAT + 1])).toBeNull();
    expect(splitByLine(SQUARE, [21.5, LAT], [21.5, LAT])).toBeNull();
  });

  it('wklesla dzialka (litera U) cieta w poprzek ramion: pole czesci sie zgadza', () => {
    const u: Position[] = [
      [0, 0],
      [3, 0],
      [3, 3],
      [2, 3],
      [2, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ].map(([x = 0, y = 0]): Position => [21 + x * 0.001, LAT + y * 0.001]);
    const parts = splitByLine(u, [21, LAT + 0.002], [21.003, LAT + 0.002]);
    const total = ringAreaM2(u);

    expect(parts).not.toBeNull();
    expect(ringAreaM2(parts?.[0] ?? []) + ringAreaM2(parts?.[1] ?? [])).toBeCloseTo(total, -1);
  });

  it('obrys z przecinajacymi sie bokami (klepsydra) nie jest poprawnym polem', () => {
    expect(isSimpleRing(SQUARE)).toBe(true);
    expect(isSimpleRing([SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]] as Position[])).toBe(false);
    expect(isSimpleRing(SQUARE.slice(0, 2))).toBe(false);
  });

  it('zapis w adresie: krotki, bez znakow do kodowania, odczyt z dokladnoscia ok. 1 m', () => {
    const text = encodeRing(SQUARE);

    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text.length).toBeLessThan(40);

    const decoded = decodeRing(text);

    expect(decoded).toHaveLength(4);
    decoded?.forEach((point, index) => {
      expect(point[0]).toBeCloseTo(SQUARE[index]?.[0] ?? 0, 5);
      expect(point[1]).toBeCloseTo(SQUARE[index]?.[1] ?? 0, 5);
    });
    expect(encodeRing(closeRing(SQUARE))).toBe(text);
  });

  it('uszkodzony zapis albo za malo punktow = null', () => {
    expect(decodeRing('')).toBeNull();
    expect(decodeRing('ab!c')).toBeNull();
    expect(decodeRing(encodeRing(SQUARE.slice(0, 2)))).toBeNull();
    expect(decodeRing(encodeRing(SQUARE).slice(0, -1))).toBeNull();

    const many = Array.from({ length: FIELD_LIMITS.maxVertices + 1 }, (_, index): Position => [
      21 + index * 0.001,
      LAT + (index % 2) * 0.001,
    ]);

    expect(decodeRing(encodeRing(many))).toBeNull();
  });
});
