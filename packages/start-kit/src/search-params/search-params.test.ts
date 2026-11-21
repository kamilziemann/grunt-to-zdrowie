import { describe, expect, it } from 'vitest';

import { parsePlainSearch, stringifyPlainSearch } from './search-params';

describe('parsePlainSearch', () => {
  it('nie parsuje JSON-a w napisach', () => {
    expect(parsePlainSearch('?q=%22a%22&tag=%5B1%5D')).toEqual({ q: '"a"', tag: '[1]' });
  });

  it('zostawia konwersje liczb z dekodera (schematy zamieniaja je na tekst)', () => {
    expect(parsePlainSearch('?page=2')).toEqual({ page: 2 });
  });
});

describe('stringifyPlainSearch', () => {
  it('napis wygladajacy jak liczba zostaje bez cudzyslowow', () => {
    expect(stringifyPlainSearch({ q: '2027' })).toBe('?q=2027');
  });

  it('pomija undefined i zwraca pusty napis bez parametrow', () => {
    expect(stringifyPlainSearch({ q: undefined })).toBe('');
  });

  it('round-trip zwyklego zapytania', () => {
    expect(parsePlainSearch(stringifyPlainSearch({ q: 'VAT 2027', page: 3 }))).toEqual({
      q: 'VAT 2027',
      page: 3,
    });
  });
});
