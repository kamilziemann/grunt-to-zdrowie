import { describe, expect, expectTypeOf, it } from 'vitest';

import { routePath, withHash, withQuery, type RouteParamName } from './route-path';

describe('routePath', () => {
  it('wzorzec bez parametrow zwraca sciezke', () => {
    expect(routePath('/analiza')).toBe('/analiza');
    expect(routePath('/')).toBe('/');
  });

  it('podstawia i koduje parametry', () => {
    // Zadna trasa nie ma dzis parametru w sciezce, wiec podstawianie sprawdzamy na wzorcu spoza drzewa tras.
    const fill = routePath as (pattern: string, params?: Record<string, string | number>) => string;

    expect(fill('/pola/$id', { id: 42 })).toBe('/pola/42');
    expect(fill('/pola/$id', { id: '12/3' })).toBe('/pola/12%2F3');
    expect(fill('/pola/$id/lata/$rok', { id: 'a b', rok: 2026 })).toBe('/pola/a%20b/lata/2026');
  });

  it('nazwy parametrow sa czytane ze wzorca', () => {
    expectTypeOf<RouteParamName<'/pola/$id/lata/$rok'>>().toEqualTypeOf<'id' | 'rok'>();
    expectTypeOf<RouteParamName<'/analiza'>>().toEqualTypeOf<never>();
  });

  it('nieznany wzorzec albo zbedny parametr to blad typow', () => {
    // @ts-expect-error -- trasy /dzialki nie ma w drzewie tras
    routePath('/dzialki');
    // @ts-expect-error -- wzorzec bez parametrow nie przyjmuje `params`
    routePath('/analiza', { id: 1 });
    expect(true).toBe(true);
  });

  it('withQuery dopisuje, nadpisuje i usuwa parametry; withHash ustawia kotwice', () => {
    const analysis = routePath('/analiza');

    expect(withQuery(analysis, { q: 'vat', page: '2' })).toBe('/analiza?q=vat&page=2');
    expect(withQuery(withQuery(analysis, { q: 'vat', page: '3' }), { page: undefined })).toBe(
      '/analiza?q=vat',
    );
    expect(withHash(routePath('/account'), 'sesje')).toBe('/account#sesje');
  });
});
