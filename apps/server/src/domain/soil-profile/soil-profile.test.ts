import { describe, expect, it } from 'vitest';

import { saxtonRawls } from '../soil-water';
import { soilProfileFromLayers, type SoilLayer } from './soil-profile';

const layer = (topCm: number, bottomCm: number, sandPct: number, clayPct: number, carbon = 0): SoilLayer => ({
  topCm,
  bottomCm,
  sandPct,
  clayPct,
  siltPct: 100 - sandPct - clayPct,
  organicCarbonGPerKg: carbon,
});

describe('soilProfileFromLayers', () => {
  it('jednorodny piasek gliniasty: zapas mm/m z Saxtona-Rawlsa, uziarnienie II, woda I -> kategoria I', () => {
    const profile = soilProfileFromLayers([layer(0, 30, 80, 8, 10), layer(30, 200, 80, 8, 10)]);
    const water = saxtonRawls({ sandPct: 80, clayPct: 8, organicMatterPct: 1.724 });

    expect(profile).toMatchObject({
      sandPct: 80,
      siltPct: 12,
      clayPct: 8,
      organicMatterPct: 1.72,
      availableWaterMmPerM: Number((water.availableWater * 1000).toFixed(1)),
      availableWaterProfileMm: Number((water.availableWater * 1500).toFixed(1)),
      category: 1,
      textureClass: 'pg',
      basis: 'texture',
      modelled: true,
    });
    // ok. 80 mm/m -> 120 mm w 1,5 m: wg wody to kategoria I, wiec zakres I-II
    expect(profile?.categoryRange).toEqual([1, 2]);
  });

  it('wazy grubosc warstw: uziarnienie z 0-150 cm, woda z 0-100 cm, materia organiczna z 0-30 cm', () => {
    // 0-50 cm piasek luzny, 50-150 cm glina: w 0-150 cm 1/3 piasku i 2/3 gliny; w 0-100 cm pol na pol
    const profile = soilProfileFromLayers([layer(0, 50, 95, 2, 20), layer(50, 200, 35, 25)]);
    const sand = saxtonRawls({ sandPct: 95, clayPct: 2, organicMatterPct: 0 });
    const loam = saxtonRawls({ sandPct: 35, clayPct: 25, organicMatterPct: 0 });
    const sandWet = saxtonRawls({ sandPct: 95, clayPct: 2, organicMatterPct: 3.448 });

    expect(profile?.sandPct).toBeCloseTo((95 + 2 * 35) / 3, 1);
    expect(profile?.clayPct).toBeCloseTo((2 + 2 * 25) / 3, 1);
    expect(profile?.organicMatterPct).toBeCloseTo(3.45, 2);
    expect(profile?.availableWaterMmPerM).toBeCloseTo(
      ((sandWet.availableWater + loam.availableWater) / 2) * 1000,
      0,
    );
    expect(sand.availableWater).toBeLessThan(sandWet.availableWater);
    // srednio 55/27/17 = glina lekka (gl) -> III, choc sama glina spod spodu bylaby IV; woda w profilu -> II,
    // do progu lzejszy koniec zakresu
    expect([profile?.textureClass, profile?.categoryRange, profile?.category]).toEqual(['gl', [2, 3], 2]);
  });

  it('bez warstw w 0-100 cm nie ma profilu', () => {
    expect(soilProfileFromLayers([])).toBeNull();
    expect(soilProfileFromLayers([layer(100, 200, 50, 20)])).toBeNull();
  });
});
