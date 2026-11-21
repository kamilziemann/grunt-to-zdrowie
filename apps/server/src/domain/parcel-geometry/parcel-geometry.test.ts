import { describe, expect, it } from 'vitest';

import { areaSquareMeters, boundingBox, centroid, containsPoint, parseWktPolygon } from './parcel-geometry';

// Prawdziwa odpowiedz ULDK dla dzialki 141201_1.0001.6509 (Minsk Mazowiecki).
const ULDK_WKT =
  'SRID=4326;POLYGON((21.5898755360546 52.1716703525845,21.590427010087 52.1722618744221,21.5903404941328 52.1722747106878,21.5901300821062 52.1722704605104,21.5898815072532 52.1722655019984,21.5897037202636 52.1722079694071,21.5893322491612 52.1718521967733,21.5898755360546 52.1716703525845))';

// Kwadrat ok. 100 m x 100 m na szerokosci 52 st.: 1 st. dlugosci = 68 677,9 m, 1 st. szerokosci = 111 267,5 m (GRS80).
const DX = 100 / 68_677.9;
const DY = 100 / 111_267.5;

function square(lng: number, lat: number, dx = DX, dy = DY): string {
  return `(${lng} ${lat},${lng + dx} ${lat},${lng + dx} ${lat + dy},${lng} ${lat + dy},${lng} ${lat})`;
}

describe('parseWktPolygon', () => {
  it('czyta poligon z prefiksem SRID', () => {
    const geometry = parseWktPolygon(ULDK_WKT);

    expect(geometry?.type).toBe('Polygon');
    expect(geometry?.coordinates[0]).toHaveLength(8);
    expect(geometry?.coordinates[0]?.[0]).toEqual([21.5898755360546, 52.1716703525845]);
  });

  it('czyta poligon z dziura i multipoligon', () => {
    const withHole = parseWktPolygon(
      `POLYGON(${square(21, 52)},${square(21.0002, 52.0002, DX / 4, DY / 4)})`,
    );
    const multi = parseWktPolygon(`MULTIPOLYGON((${square(21, 52)}),((${square(21.01, 52)})))`);

    expect(withHole).toMatchObject({ type: 'Polygon' });
    expect(withHole?.coordinates).toHaveLength(2);
    expect(multi).toMatchObject({ type: 'MultiPolygon' });
    expect(multi?.coordinates).toHaveLength(2);
  });

  it('zwraca null dla tekstu, ktory nie jest poligonem', () => {
    expect(parseWktPolygon('')).toBeNull();
    expect(parseWktPolygon('POINT(21 52)')).toBeNull();
    expect(parseWktPolygon('POLYGON((21 52,21 53))')).toBeNull();
  });
});

describe('pomiary geometrii', () => {
  it('liczy powierzchnie kwadratu 100 m x 100 m jako 1 ha', () => {
    const geometry = parseWktPolygon(`POLYGON(${square(21, 52)})`);

    expect(geometry).not.toBeNull();
    expect(areaSquareMeters(geometry ?? { type: 'Polygon', coordinates: [] })).toBeCloseTo(10_000, -1);
  });

  it('odejmuje dziure i sumuje czesci multipoligonu', () => {
    const withHole = parseWktPolygon(
      `POLYGON(${square(21, 52)},${square(21.0002, 52.0002, DX / 2, DY / 2)})`,
    );
    const multi = parseWktPolygon(`MULTIPOLYGON((${square(21, 52)}),(${square(21.01, 52)}))`);

    expect(areaSquareMeters(withHole ?? { type: 'Polygon', coordinates: [] })).toBeCloseTo(7500, -1);
    expect(areaSquareMeters(multi ?? { type: 'Polygon', coordinates: [] })).toBeCloseTo(20_000, -1);
  });

  it('wyznacza prostokat otaczajacy i srodek', () => {
    const geometry = parseWktPolygon(`POLYGON(${square(21, 52)})`) ?? { type: 'Polygon', coordinates: [] };
    const [lng, lat] = centroid(geometry);

    expect(boundingBox(geometry)).toEqual([21, 52, 21 + DX, 52 + DY]);
    expect(lng).toBeCloseTo(21 + DX / 2, 7);
    expect(lat).toBeCloseTo(52 + DY / 2, 7);
  });

  it('rozpoznaje punkt w srodku, na zewnatrz i w dziurze', () => {
    const withHole = parseWktPolygon(
      `POLYGON(${square(21, 52)},${square(21.0002, 52.0002, DX / 4, DY / 4)})`,
    ) ?? { type: 'Polygon', coordinates: [] };

    expect(containsPoint(withHole, [21 + DX * 0.9, 52 + DY * 0.9])).toBe(true);
    expect(containsPoint(withHole, [21 + DX * 2, 52])).toBe(false);
    expect(containsPoint(withHole, [21.0002 + DX / 8, 52.0002 + DY / 8])).toBe(false);
  });

  it('dzialka z ULDK ma wiarygodna powierzchnie', () => {
    const geometry = parseWktPolygon(ULDK_WKT) ?? { type: 'Polygon', coordinates: [] };

    expect(areaSquareMeters(geometry)).toBeGreaterThan(2000);
    expect(areaSquareMeters(geometry)).toBeLessThan(4000);
  });
});
