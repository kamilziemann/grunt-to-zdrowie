import { describe, expect, it } from 'vitest';

import { validateParcelSearch } from './parcel-search.schema';

describe('validateParcelSearch', () => {
  it('przycina i przepuszcza numer albo obreb z numerem', () => {
    expect(validateParcelSearch('  141201_1.0001.6509 ')).toEqual({ ok: true, query: '141201_1.0001.6509' });
    expect(validateParcelSearch('Dąbrowa 12')).toEqual({ ok: true, query: 'Dąbrowa 12' });
  });

  it('za krotki i za dlugi tekst dostaja wlasne komunikaty', () => {
    expect(validateParcelSearch(' 1 ')).toEqual({ ok: false, error: 'tooShort' });
    expect(validateParcelSearch('x'.repeat(200))).toEqual({ ok: false, error: 'tooLong' });
  });
});
