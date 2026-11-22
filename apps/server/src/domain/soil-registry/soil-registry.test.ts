import { describe, expect, it } from 'vitest';

import type { SoilProfile } from '../analysis-ports';
import { reconcileSoilWithRegistry } from './soil-registry';

const soil = (category: 1 | 2 | 3 | 4, extra: Partial<SoilProfile> = {}): SoilProfile => ({
  sandPct: 26,
  siltPct: 50,
  clayPct: 24,
  organicMatterPct: 2,
  fieldCapacity: 0.3,
  wiltingPoint: 0.14,
  availableWaterMmPerM: 157,
  availableWaterProfileMm: 235.6,
  category,
  categoryRange: [category, category],
  basis: 'texture',
  modelled: true,
  ...extra,
});

describe('reconcileSoilWithRegistry', () => {
  it('sama klasa VI przy glebie ciezkiej z modelu: kategoria I i zapas wody gleby lekkiej (Korfantow)', () => {
    const { soil: fixed, conflict } = reconcileSoilWithRegistry(soil(4), ['RVI']);

    expect(conflict).toEqual({ direction: 'lighter', modelCategory: 4, category: 1, classes: ['VI'] });
    expect(fixed).toMatchObject({
      category: 1,
      categoryRange: [1, 4],
      availableWaterProfileMm: 110,
      basis: 'both',
    });
    expect(fixed.availableWaterMmPerM).toBeCloseTo(73.3, 1);
  });

  it('klasy V-VI: kategoria II; model juz lekki albo klasy mieszane - bez zmian', () => {
    expect(reconcileSoilWithRegistry(soil(3), ['RV', 'ŁVI']).soil.category).toBe(2);
    expect(reconcileSoilWithRegistry(soil(2), ['RV', 'RVI']).conflict).toBeNull();
    expect(reconcileSoilWithRegistry(soil(4), ['RIVb', 'RV', 'RVI']).conflict).toBeNull();
    expect(reconcileSoilWithRegistry(soil(4), ['RIIIa', 'RIVa']).conflict).toBeNull();
  });

  it('klasy I-II przy glebie bardzo lekkiej z modelu: co najmniej kategoria III', () => {
    const { soil: fixed, conflict } = reconcileSoilWithRegistry(soil(1), ['RI', 'RII']);

    expect(conflict).toMatchObject({ direction: 'heavier', modelCategory: 1, category: 3 });
    expect(fixed.categoryRange).toEqual([1, 3]);
  });

  it('bez klas rolnych (las, zabudowa, brak ewidencji) i dla gleby niemodelowanej nic nie zmienia', () => {
    expect(reconcileSoilWithRegistry(soil(4), ['LsV', 'Bi']).conflict).toBeNull();
    expect(reconcileSoilWithRegistry(soil(4), undefined).conflict).toBeNull();
    expect(reconcileSoilWithRegistry(soil(4, { modelled: false }), ['RVI']).conflict).toBeNull();
  });
});
