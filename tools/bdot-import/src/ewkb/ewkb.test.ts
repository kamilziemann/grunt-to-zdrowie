import { describe, expect, it } from 'vitest';

import { toEwkbHex } from './ewkb';

describe('toEwkbHex', () => {
  it('linia: naglowek z SRID 2180, liczba punktow i wspolrzedne little endian', () => {
    const hex = toEwkbHex(
      {
        type: 'LineString',
        coordinates: [
          [1, 2],
          [3, 4],
        ],
      },
      2180,
    );

    // 01 | typ 2 + flaga SRID | 2180 = 0x884 | 2 punkty | 1.0 2.0 3.0 4.0
    expect(hex).toBe(
      '01020000208408000002000000000000000000f03f000000000000004000000000000008400000000000001040',
    );
  });

  it('punkt: naglowek z SRID i same wspolrzedne, bez licznika', () => {
    const hex = toEwkbHex({ type: 'Point', coordinates: [1, 2] }, 2180);

    // bajt porzadku + typ 1 z flaga SRID + SRID 2180 + x=1 + y=2
    expect(hex).toBe('010100002084080000000000000000f03f0000000000000040');
  });

  it('poligon: liczba pierscieni przed punktami', () => {
    const hex = toEwkbHex(
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      2180,
    );

    expect(hex.startsWith('0103000020840800000100000004000000')).toBe(true);
    expect(hex).toHaveLength((1 + 4 + 4 + 4 + 4 + 4 * 16) * 2);
  });

  it('wieloczesciowe: kazda czesc ma wlasny naglowek bez SRID', () => {
    const hex = toEwkbHex(
      {
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [1, 1],
          ],
          [
            [2, 2],
            [3, 3],
          ],
        ],
      },
      2180,
    );

    expect(hex.startsWith('01050000208408000002000000010200000002000000')).toBe(true);
  });

  it('rosnie ponad bufor startowy przy dlugich liniach', () => {
    const coordinates = Array.from({ length: 500 }, (_unused, index) => [index, index] as const);
    const hex = toEwkbHex({ type: 'LineString', coordinates }, 2180);

    expect(hex).toHaveLength((1 + 4 + 4 + 4 + 500 * 16) * 2);
  });
});
