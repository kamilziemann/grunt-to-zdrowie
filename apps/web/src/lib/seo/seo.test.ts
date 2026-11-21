import { describe, expect, it } from 'vitest';

import { BRAND, headLocale, pageHead } from './seo';

describe('pageHead', () => {
  it('tytul z marka i lokalizacja Open Graph; bez adresu serwisu bez kanonicznego', () => {
    const head = pageHead({ title: 'Gospodarka', locale: 'en', path: '/analiza' });

    expect(head.meta).toContainEqual({ title: `Gospodarka · ${BRAND}` });
    expect(head.meta).toContainEqual({ property: 'og:locale', content: 'en_GB' });
    expect(head.links).toEqual([]);
  });
});

describe('headLocale', () => {
  it('jezyk z layoutu {-$locale}, komunikaty polaczone z layoutami sekcji', () => {
    const result = headLocale([
      { routeId: '__root__' },
      { routeId: '/{-$locale}', loaderData: { locale: 'en', messages: { common: { a: 1 } } } },
      { routeId: '/{-$locale}/_app/_dev', loaderData: { messages: { design: { b: 2 } } } },
    ]);

    expect(result.locale).toBe('en');
    expect(Object.keys(result.messages)).toEqual(['common', 'design']);
  });

  it('bez danych layoutu: polski i brak komunikatow', () => {
    expect(headLocale([{ routeId: '__root__' }])).toEqual({ locale: 'pl', messages: {} });
  });
});
