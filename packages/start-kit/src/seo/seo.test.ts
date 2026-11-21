import { describe, expect, it } from 'vitest';

import { seoHead } from './seo';

describe('seoHead', () => {
  it('tytul z marka, opis, Open Graph, kanoniczny i hreflang', () => {
    const head = seoHead({
      siteName: 'Grunt to Zdrowie',
      title: 'Analiza',
      description: 'Lead',
      type: 'article',
      canonical: 'https://example.com/articles/a',
      alternates: { pl: 'https://example.com/articles/a', en: 'https://example.com/en/articles/a' },
      extra: { 'article:section': 'Gospodarka', 'article:author': undefined },
    });

    expect(head.meta).toContainEqual({ title: 'Analiza · Grunt to Zdrowie' });
    expect(head.meta).toContainEqual({ property: 'og:type', content: 'article' });
    expect(head.meta).toContainEqual({ property: 'article:section', content: 'Gospodarka' });
    expect(head.meta.some((m) => 'property' in m && m.property === 'article:author')).toBe(false);
    expect(head.links).toEqual([
      { rel: 'canonical', href: 'https://example.com/articles/a' },
      { rel: 'alternate', hrefLang: 'pl', href: 'https://example.com/articles/a' },
      { rel: 'alternate', hrefLang: 'en', href: 'https://example.com/en/articles/a' },
    ]);
  });

  it('bez tytulu sama marka', () => {
    expect(seoHead({ siteName: 'Grunt to Zdrowie' }).meta[0]).toEqual({ title: 'Grunt to Zdrowie' });
  });
});
