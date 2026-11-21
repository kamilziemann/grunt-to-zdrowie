import { describe, expect, it } from 'vitest';

import { cacheKey, cachedFetch, memoryResponseStore, type FetchLike } from './response-cache';

function counting(status = 200): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const impl = (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url} ${typeof init?.body === 'string' ? init.body : ''}`);

    return Promise.resolve(new Response(`odpowiedz ${calls.length}`, { status }));
  };

  return Object.assign(impl, { calls });
}

describe('cachedFetch', () => {
  it('drugie takie samo zapytanie GET idzie z pamieci, inne adresy - do dostawcy', async () => {
    const upstream = counting();
    const cached = cachedFetch(upstream, memoryResponseStore(), () => 60);

    expect(await (await cached('https://power.example/a')).text()).toBe('odpowiedz 1');
    expect(await (await cached('https://power.example/a')).text()).toBe('odpowiedz 1');
    expect(await (await cached('https://power.example/b')).text()).toBe('odpowiedz 2');
    expect(upstream.calls).toHaveLength(2);
  });

  it('POST: klucz ze skrotu tresci - ta sama tresc z pamieci, inna do dostawcy', async () => {
    const upstream = counting();
    const cached = cachedFetch(upstream, memoryResponseStore(), () => 60);
    const post = (body: string) => cached('https://sh.example/statistics', { method: 'POST', body });

    await post('{"okno":1}');
    await post('{"okno":1}');
    await post('{"okno":2}');

    expect(upstream.calls).toHaveLength(2);
    expect(await cacheKey('https://sh.example/statistics', { method: 'POST', body: 'x' })).toMatch(
      /^https:\/\/sh\.example\/statistics\?cache-body=[0-9a-f]{64}$/,
    );
  });

  it('bledow (np. 429) i zapytan z czasem zycia 0 nie pamieta; wpis wygasa po max-age', async () => {
    let clock = 0;
    const store = memoryResponseStore(() => clock);
    const limited = counting(429);
    const plain = counting();

    await cachedFetch(limited, store, () => 60)('https://sh.example/x');
    await cachedFetch(limited, store, () => 60)('https://sh.example/x');
    await cachedFetch(plain, store, () => 0)('https://sh.example/y');
    await cachedFetch(plain, store, () => 0)('https://sh.example/y');

    expect(limited.calls).toHaveLength(2);
    expect(plain.calls).toHaveLength(2);

    const timed = cachedFetch(plain, store, () => 60);

    await timed('https://sh.example/z');
    clock = 61_000;
    await timed('https://sh.example/z');

    expect(plain.calls).toHaveLength(4);
  });

  it('bez pamieci (null) to zwykly fetch', async () => {
    const upstream = counting();

    expect(cachedFetch(upstream, null, () => 60)).toBe(upstream);
  });
});
