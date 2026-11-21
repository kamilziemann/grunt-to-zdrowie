import { describe, expect, it } from 'vitest';

import { cacheHeaders } from './headers';

describe('cacheHeaders', () => {
  it('publiczna tresc: polityka brzegu, przegladarka rewaliduje, tagi z tagiem strony', () => {
    expect(cacheHeaders('editorial', ['content', 'article:a'])).toEqual({
      'cache-control': 'public, max-age=0, must-revalidate',
      'cloudflare-cdn-cache-control':
        'public, max-age=600, stale-while-revalidate=86400, stale-if-error=86400',
      'cache-tag': 'site,content,article:a',
    });
  });

  it('prywatna: tylko no-store, bez tagow', () => {
    expect(cacheHeaders('private', ['content'])).toEqual({ 'cache-control': 'private, no-store' });
  });
});
