import { describe, expect, it } from 'vitest';

import { iungCategoryFromTexture, iungCategoryFromWater, ptgTextureClass } from './soil-category';

describe('ptgTextureClass (PTG 2008, tab. 2)', () => {
  it.each([
    [95, 3, 2, 'pl'],
    [88, 8, 4, 'ps'],
    [80, 12, 8, 'pg'],
    [73, 16, 11, 'gp'],
    [50, 45, 5, 'gp'],
    [58, 30, 12, 'gl'],
    [60, 15, 25, 'gpi'],
    [40, 40, 20, 'gz'],
    [30, 37, 33, 'gi'],
    [12, 51, 37, 'gpyi'],
    [30, 62, 8, 'pyg'],
    [10, 85, 5, 'pyz'],
    [20, 62, 18, 'pyi'],
    [50, 10, 40, 'ip'],
    [8, 45, 47, 'ipy'],
    [25, 25, 50, 'iz'],
    [15, 20, 65, 'ic'],
  ] as const)('%i/%i/%i -> %s', (sandPct, siltPct, clayPct, expected) => {
    expect(ptgTextureClass({ sandPct, siltPct, clayPct })).toBe(expected);
  });

  it('normalizuje frakcje do 100% (SoilGrids przewiduje je osobno)', () => {
    expect(ptgTextureClass({ sandPct: 47.5, siltPct: 2, clayPct: 0.5 })).toBe('pl');
  });
});

describe('iungCategoryFromTexture', () => {
  it('ciezkosc agronomiczna: piaski luzne i slabogliniaste I, gliniaste II, gliny lekkie i pyly III, ciezkie IV', () => {
    const category = (sandPct: number, siltPct: number, clayPct: number) =>
      iungCategoryFromTexture({ sandPct, siltPct, clayPct }).category;

    expect([category(95, 3, 2), category(88, 8, 4)]).toEqual([1, 1]);
    expect(category(80, 12, 8)).toBe(2);
    expect([category(73, 16, 11), category(58, 30, 12), category(10, 85, 5), category(30, 62, 8)]).toEqual([
      3, 3, 3, 3,
    ]);
    expect([category(40, 40, 20), category(12, 51, 37), category(25, 25, 50)]).toEqual([4, 4, 4]);
  });

  it('reguly PTG pokrywaja caly trojkat uziarnienia (krok 0,25%) - szacunek zapasowy zostaje dla ulamkow', () => {
    const gaps: number[][] = [];

    for (let clay = 0; clay <= 100; clay += 0.25) {
      for (let sand = 0; sand <= 100 - clay; sand += 0.25) {
        const texture = { sandPct: sand, siltPct: 100 - sand - clay, clayPct: clay };

        if (ptgTextureClass(texture) === null) gaps.push([sand, clay]);
      }
    }

    expect(gaps).toEqual([]);
  });
});

describe('iungCategoryFromWater', () => {
  it('granice WOD IUNG: < 127,5 I, 127,5-169,9 II, 170-202,5 III, > 202,5 IV', () => {
    expect([127.4, 127.5, 169.9, 170, 202.5, 202.6].map(iungCategoryFromWater)).toEqual([1, 2, 2, 3, 3, 4]);
  });
});
