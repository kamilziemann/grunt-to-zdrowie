import { describe, expect, it } from 'vitest';

import { cacheTags, isValidTag, normalizeTags, SITE_TAG } from './tags';

describe('tagi cache', () => {
  it('buduja przewidywalne nazwy i koduja znaki spoza ASCII', () => {
    expect(cacheTags.parcels()).toBe('parcels');
    expect(cacheTags.page('O-Nas')).toBe('page:o-nas');
    expect(cacheTags.page('o nas i życie')).toBe('page:o%20nas%20i%20%C5%BCycie');
  });

  it('normalizeTags dodaje tag strony, usuwa duplikaty i niepoprawne wartosci', () => {
    expect(normalizeTags(['content', 'CONTENT', 'zły tag', 'a,b'])).toEqual([SITE_TAG, 'content']);
  });

  it('isValidTag pilnuje limitu i znakow', () => {
    expect(isValidTag('x'.repeat(1024))).toBe(true);
    expect(isValidTag('x'.repeat(1025))).toBe(false);
    expect(isValidTag('')).toBe(false);
  });
});
