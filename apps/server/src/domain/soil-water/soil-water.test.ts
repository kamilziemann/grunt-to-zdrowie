import { describe, expect, it } from 'vitest';

import { organicMatterFromCarbon, saxtonRawls } from './soil-water';

describe('saxtonRawls', () => {
  it('przyklad z notatki: 60% piasku, 15% ilu, 2% materii organicznej -> WP 0,105, FC 0,208, 103 mm/m', () => {
    const water = saxtonRawls({ sandPct: 60, clayPct: 15, organicMatterPct: 2 });

    expect(water.wiltingPoint).toBeCloseTo(0.1053, 4);
    expect(water.fieldCapacity).toBeCloseTo(0.2084, 4);
    expect(water.availableWater * 1000).toBeCloseTo(103.2, 1);
  });

  // Saxton i Rawls 2006, tab. 3 (klasy USDA przy 2,5% materii organicznej): PWP, FC i AW w % objetosci,
  // liczby drukowane w tabeli sa zaokraglone do calych procent.
  it.each([
    ['piasek', 88, 5, 5, 10, 5],
    ['piasek gliniasty', 80, 5, 5, 12, 7],
    ['glina piaszczysta', 65, 10, 8, 18, 10],
    ['glina', 40, 20, 14, 28, 14],
    ['glina pylasta', 20, 15, 11, 31, 20],
    ['pyl', 10, 5, 6, 30, 25],
    ['glina piaszczysto-ilasta', 60, 25, 17, 27, 10],
    ['glina ilasta', 30, 35, 22, 36, 14],
    ['ił pylasty', 10, 45, 27, 41, 14],
    ['ił', 25, 50, 30, 42, 12],
  ])('%s (%i/%i): PWP %i%%, FC %i%%, AW %i%%', (_name, sand, clay, pwp, fc, aw) => {
    const water = saxtonRawls({ sandPct: sand, clayPct: clay, organicMatterPct: 2.5 });

    expect(Math.round(water.wiltingPoint * 100)).toBe(pwp);
    expect(Math.round(water.fieldCapacity * 100)).toBe(fc);
    expect(Math.round(water.availableWater * 100)).toBe(aw);
  });

  it('przycina wejscie do zakresu regresji (il <= 60%, materia organiczna <= 8%)', () => {
    expect(saxtonRawls({ sandPct: 5, clayPct: 80, organicMatterPct: 20 })).toEqual(
      saxtonRawls({ sandPct: 5, clayPct: 60, organicMatterPct: 8 }),
    );
  });

  it('wegiel organiczny g/kg -> materia organiczna % (x 1,724)', () => {
    expect(organicMatterFromCarbon(10)).toBeCloseTo(1.724, 3);
  });
});
