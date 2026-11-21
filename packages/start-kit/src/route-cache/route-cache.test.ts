import { describe, expect, it } from 'vitest';

import { routeCache, withDefaultCacheControl } from './route-cache';

describe('routeCache', () => {
  it('tagi z danych loadera', () => {
    const headers = routeCache<{ slug: string }>('editorial', (data) => ['content', `article:${data?.slug}`]);

    expect(headers({ loaderData: { slug: 'a' } })['cache-tag']).toBe('site,content,article:a');
  });
});

describe('withDefaultCacheControl', () => {
  it('dokleja no-store tylko, gdy odpowiedz nie ma polityki', () => {
    expect(withDefaultCacheControl(new Response('x')).headers.get('cache-control')).toBe('private, no-store');
    const own = new Response('x', { headers: { 'cache-control': 'public, max-age=0' } });

    expect(withDefaultCacheControl(own).headers.get('cache-control')).toBe('public, max-age=0');
  });
});
