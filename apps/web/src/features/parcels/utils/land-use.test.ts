import { describe, expect, it } from 'vitest';

import { nonFarmKinds } from './land-use';

describe('nonFarmKinds', () => {
  it('grunt rolny albo brak danych = nic do podpowiedzenia', () => {
    expect(nonFarmKinds(undefined)).toEqual([]);
    expect(nonFarmKinds([])).toEqual([]);
    expect(nonFarmKinds(['RIVb', 'ŁV'])).toEqual([]);
    expect(nonFarmKinds(['LsV', 'PsIV'])).toEqual([]);
    expect(nonFarmKinds(['Lzr-RV'])).toEqual([]);
    expect(nonFarmKinds(['Br-RIIIa'])).toEqual([]);
  });

  it('las, zabudowa i woda bez uzytku rolnego', () => {
    expect(nonFarmKinds(['LsV'])).toEqual(['forest']);
    expect(nonFarmKinds(['dr', 'Bi'])).toEqual(['built']);
    expect(nonFarmKinds(['Wp', 'Lz'])).toEqual(['water', 'forest']);
  });
});
