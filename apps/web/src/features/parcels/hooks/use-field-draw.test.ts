import { describe, expect, it } from 'vitest';

import { closeRing, decodeRing, type Position } from '@/lib/field-geometry';

import { deriveFieldDraw, insideRing, type SplitTarget } from './use-field-draw';

const SQUARE: Position[] = [
  [21.5, 52.17],
  [21.502, 52.17],
  [21.502, 52.171],
  [21.5, 52.171],
];
const TARGET: SplitTarget = {
  id: '141201_1.0001.6509',
  number: '6509',
  geometry: { type: 'Polygon', coordinates: [closeRing(SQUARE)] },
};

describe('tryb "wlasne pole"', () => {
  it('rysowanie: do 3 punktow brak obszaru, potem pole na biezaco i obrys w adresie', () => {
    const two = deriveFieldDraw('draw', SQUARE.slice(0, 2), 0, null);

    expect(two).toMatchObject({ issue: 'needMore', missingPoints: 1, areaHa: null, area: null });

    const full = deriveFieldDraw('draw', SQUARE, 0, null);

    expect(full.issue).toBeNull();
    expect(full.areaHa).toBeGreaterThan(1.5);
    expect(full.area?.rodzaj).toBe('drawn');
    expect(decodeRing(full.area?.obszar ?? '')).toHaveLength(4);
  });

  it('rysowanie: przeciete boki blokuja analize', () => {
    const bowtie = deriveFieldDraw(
      'draw',
      [SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]] as Position[],
      0,
      null,
    );

    expect(bowtie.issue).toBe('selfIntersecting');
    expect(bowtie.area).toBeNull();
  });

  it('podzial: dwie czesci, wybrana idzie do analizy jako czesc dzialki', () => {
    const line: Position[] = [
      [21.501, 52.169],
      [21.501, 52.172],
    ];
    const result = deriveFieldDraw('split', line, 1, TARGET);

    expect(result.partsHa?.[0]).toBeCloseTo(result.partsHa?.[1] ?? 0, 3);
    expect(result.area).toMatchObject({ rodzaj: 'part', parcelIds: [TARGET.id] });
    expect(result.overlay.areas.map((area) => area.role)).toEqual(['other', 'chosen']);
  });

  it('podzial: jeden punkt albo linia obok dzialki = komunikat, bez analizy', () => {
    expect(deriveFieldDraw('split', [[21.501, 52.169]], 0, TARGET).issue).toBe('lineMissing');
    expect(
      deriveFieldDraw(
        'split',
        [
          [21.6, 52.1],
          [21.6, 52.2],
        ],
        0,
        TARGET,
      ).issue,
    ).toBe('lineOutside');
  });
});

describe('insideRing', () => {
  it('rozpoznaje punkt w srodku i poza kwadratem', () => {
    expect(insideRing([21.501, 52.1705], SQUARE)).toBe(true);
    expect(insideRing([21.51, 52.1705], SQUARE)).toBe(false);
  });

  it('podzial: obie czesci maja obrysy, w ktore da sie stuknac', () => {
    const split = deriveFieldDraw(
      'split',
      [
        [21.501, 52.169],
        [21.501, 52.172],
      ],
      0,
      TARGET,
    );
    const [a, b] = split.partRings ?? [[], []];

    expect(insideRing([21.5005, 52.1705], a) !== insideRing([21.5005, 52.1705], b)).toBe(true);
  });
});
