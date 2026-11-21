import { describe, expect, it } from 'vitest';

import { simplifyLine, simplifyRing, type Position } from './simplify';

describe('simplifyLine', () => {
  it('usuwa punkty lezace blizej uproszczonej linii niz tolerancja', () => {
    const line: Position[] = [
      [0, 0],
      [50, 0.5],
      [100, 0],
      [150, 30],
      [200, 0],
    ];

    expect(simplifyLine(line, 2)).toEqual([
      [0, 0],
      [100, 0],
      [150, 30],
      [200, 0],
    ]);
  });

  it('zostawia konce i krotkie linie bez zmian', () => {
    const line: Position[] = [
      [0, 0],
      [10, 0],
    ];

    expect(simplifyLine(line, 5)).toEqual(line);
    expect(
      simplifyLine(
        [
          [0, 0],
          [5, 1],
          [10, 0],
        ],
        0,
      ),
    ).toHaveLength(3);
  });
});

describe('simplifyRing', () => {
  it('upraszcza pierscien, zachowujac zamkniecie', () => {
    const ring: Position[] = [
      [0, 0],
      [50, 0.2],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    const result = simplifyRing(ring, 2);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual(result.at(-1));
  });

  it('nie degeneruje malego pierscienia', () => {
    const ring: Position[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];

    expect(simplifyRing(ring, 10)).toEqual(ring);
  });
});
