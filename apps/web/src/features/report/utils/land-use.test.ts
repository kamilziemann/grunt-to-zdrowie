import { LAND_USE_KINDS } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { FULL_CATALOG } from '@/i18n/full-catalog';

import { classRange, landUseGroups, landUseKindOf, registryArea } from './land-use';

describe('uzytki z ewidencji', () => {
  it('rodzaj z oznaczenia: liczy sie czesc przed "/", dluzsze oznaczenia przed krotszymi', () => {
    expect(
      [
        'RIVb',
        'S-RIIIa',
        'ŁV',
        'PsVI',
        'W/ŁV',
        'Wsr',
        'Br/RIVa',
        'Lzr/RVI',
        'LsV',
        'dr',
        'Bi',
        'Tk',
        'N',
        '?',
      ].map(landUseKindOf),
    ).toEqual([
      'arable',
      'orchard',
      'meadow',
      'pasture',
      'ditches',
      'ponds',
      'farm_buildings',
      'farm_woodland',
      'forest',
      'road',
      'built',
      'railway',
      'wasteland',
      'other',
    ]);
  });

  it('grupy: grunty uprawne z klasami od najlepszej, row na lace bez klasy, kolejnosc jak w ewidencji', () => {
    expect(landUseGroups(['RIVb', 'RV', 'RVI', 'ŁV', 'W/ŁV'])).toEqual([
      { kind: 'arable', classes: ['IVb', 'V', 'VI'] },
      { kind: 'meadow', classes: ['V'] },
      { kind: 'ditches', classes: [] },
    ]);
    expect(landUseGroups(['LsV'])).toEqual([{ kind: 'forest', classes: [] }]);
  });

  it('zakres klas: jedna albo od-do; brak klas = null', () => {
    expect(classRange(['V'])).toEqual({ from: 'V', to: 'V' });
    expect(classRange(['IVb', 'V', 'VI'])).toEqual({ from: 'IVb', to: 'VI' });
    expect(classRange([])).toBeNull();
  });

  it('powierzchnia ewidencyjna z pola albo z opisu uzytku', () => {
    expect(registryArea({ field: { registryAreaHa: 1.2 } })).toBe(1.2);
    expect(
      registryArea({
        field: {},
        landUse: {
          codes: ['RV'],
          kinds: ['arable'],
          agricultural: true,
          soilClasses: ['V'],
          cropHint: null,
          mismatch: null,
          registryAreaHa: 3.4,
        },
      }),
    ).toBe(3.4);
    expect(registryArea({ field: {} })).toBeNull();
  });

  it('kazdy rodzaj uzytku z kontraktu ma nazwe w tlumaczeniach', () => {
    const report = FULL_CATALOG.pl.report as { landUse: { kinds: Record<string, string> } };

    expect(Object.keys(report.landUse.kinds).toSorted()).toEqual([...LAND_USE_KINDS].toSorted());
  });
});
