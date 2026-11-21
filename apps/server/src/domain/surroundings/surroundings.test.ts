import { describe, expect, it } from 'vitest';

import { protectedAreasFromRows, surroundingsFromRows } from './surroundings';

// Wiersze jak z bazy (zapytania sprawdzone na zywo 22.11.2026): 080904_5.0001.349/1 - jaz 347 m, 44 waly w 3 km,
// rzad drzew 137 m od granicy, zadnych drzew przy granicy (1900 m).
const chwalim = {
  cover: [
    { kind: 23, features: 2, nearestM: 137.4, nearestName: null },
    { kind: 24, features: 2, nearestM: 433.2, nearestName: null },
  ],
  edge: { edgeM: 1900.2, woodedEdgeM: 0 },
  waterworks: [
    { kind: 30, features: 6, nearestM: 347.2, nearestName: null },
    { kind: 40, features: 44, nearestM: 1106.3, nearestName: null },
  ],
  junction: null,
  protectedAreas: [],
};

describe('surroundingsFromRows', () => {
  it('pole bez drzew przy granicy, jaz 347 m, waly w promieniu', () => {
    expect(surroundingsFromRows(chwalim)).toEqual({
      trees: {
        bandM: 15,
        edgeM: 1900,
        woodedEdgeM: 0,
        woodedEdgeShare: 0,
        nearestForestM: null,
        nearestTreeRowM: 137,
        searchRadiusM: 500,
        openToWind: true,
      },
      water: {
        searchRadiusM: 3000,
        nearestStructure: { kind: 'weir', distanceM: 347, name: null },
        structures: 6,
        levees: 44,
        nearestLeveeM: 1106,
        nearestSpring: null,
        nearestIntakeM: null,
        pipedSegments: 0,
        pipedJunction: null,
        junctionRadiusM: 500,
      },
      protectedAreas: [],
    });
  });

  it('las na calej granicy: oslonione, udzial nie przekracza 1 mimo pasa z obu stron rogu', () => {
    const result = surroundingsFromRows({
      ...chwalim,
      cover: [{ kind: 20, features: 10, nearestM: 0, nearestName: null }],
      edge: { edgeM: 217, woodedEdgeM: 230 },
    });

    expect(result.trees).toMatchObject({
      woodedEdgeM: 217,
      woodedEdgeShare: 1,
      nearestForestM: 0,
      nearestTreeRowM: null,
      openToWind: false,
    });
  });

  it('zrodlo z nazwa, ujecie, odcinki w rurach i styk rowu z rura', () => {
    const { water } = surroundingsFromRows({
      ...chwalim,
      waterworks: [
        { kind: 34, features: 1, nearestM: 210.6, nearestName: 'Źródło Marii' },
        { kind: 33, features: 2, nearestM: 1500, nearestName: null },
        { kind: 41, features: 2, nearestM: 120, nearestName: null },
        { kind: 42, features: 1, nearestM: 900, nearestName: null },
        { kind: 32, features: 1, nearestM: 2500, nearestName: 'Śluza Gałkowo' },
      ],
      junction: { distanceM: 120.4, point: [17.1234567, 52.7654321] },
    });

    expect(water).toMatchObject({
      nearestStructure: { kind: 'lock', distanceM: 2500, name: 'Śluza Gałkowo' },
      structures: 1,
      levees: 0,
      nearestLeveeM: null,
      nearestSpring: { distanceM: 211, name: 'Źródło Marii' },
      nearestIntakeM: 1500,
      pipedSegments: 3,
      pipedJunction: { distanceM: 120, point: [17.123457, 52.765432] },
    });
  });
});

describe('protectedAreasFromRows', () => {
  it('jeden wpis na obszar, od najsilniejszej ochrony; nieznany kod i brak nazwy pominiete', () => {
    expect(
      protectedAreasFromRows([
        { kind: 50, name: 'Ostoja Biebrzańska' },
        { kind: 52, name: 'Biebrzański Park Narodowy' },
        { kind: 50, name: 'Dolina Biebrzy' },
        { kind: 50, name: 'Ostoja Biebrzańska' },
        { kind: 50, name: null },
        { kind: 99, name: 'Coś' },
      ]),
    ).toEqual([
      { kind: 'national_park', name: 'Biebrzański Park Narodowy' },
      { kind: 'natura2000', name: 'Dolina Biebrzy' },
      { kind: 'natura2000', name: 'Ostoja Biebrzańska' },
    ]);
  });
});
