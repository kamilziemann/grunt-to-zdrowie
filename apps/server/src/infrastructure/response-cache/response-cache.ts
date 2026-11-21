// Pamiec odpowiedzi zewnetrznych zrodel analizy (NASA POWER, SoilGrids, Copernicus): kilka analiz pod rzad (tryb
// "gospodarstwo", sasiednie dzialki, powtorka tej samej) nie pyta dostawcy drugi raz o to samo. W Workerze to Cache API
// (`caches.default`, pamiec centrum danych Cloudflare), w testach - mapa w procesie. Klucz: adres GET albo adres +
// skrot SHA-256 tresci POST. Czas zycia wybiera adapter (`ttl`): historia - dlugo, biezace dni - krotko, 0 = bez
// pamieci. Pamietamy tylko odpowiedzi 200; blad pamieci nigdy nie psuje zapytania.
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Podzbior Cache API, ktorego uzywamy (klucz zawsze jako adres GET). */
export interface ResponseStore {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

/** Ile sekund pamietac odpowiedz na to zapytanie; 0 = nie pamietac. */
export type CacheTtl = (url: string, init: RequestInit | undefined) => number;

const BODY_PARAM = 'cache-body';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Klucz pamieci: adres GET; dla POST - adres z dopisanym skrotem tresci (Cache API przyjmuje tylko GET). */
export async function cacheKey(url: string, init?: RequestInit): Promise<string> {
  const method = (init?.method ?? 'GET').toUpperCase();

  if (method === 'GET') return url;

  const body = typeof init?.body === 'string' ? init.body : '';
  const key = new URL(url);

  key.searchParams.set(BODY_PARAM, await sha256Hex(`${method}\n${body}`));

  return key.toString();
}

/** Opakowuje fetch pamiecia odpowiedzi; trafienie zwraca kopie bez pytania dostawcy. */
export function cachedFetch(fetchImpl: FetchLike, store: ResponseStore | null, ttl: CacheTtl): FetchLike {
  if (!store) return fetchImpl;

  return async (url, init) => {
    const seconds = ttl(url, init);

    if (seconds <= 0) return fetchImpl(url, init);

    const key = await cacheKey(url, init);
    const hit = await store.match(key).catch(() => undefined);

    if (hit) return hit;

    const response = await fetchImpl(url, init);

    if (response.status !== 200) return response;

    const headers = new Headers(response.headers);

    headers.set('cache-control', `public, max-age=${Math.round(seconds)}`);
    // Set-Cookie blokuje zapis w Cache API; dostawcy danych go nie potrzebuja
    headers.delete('set-cookie');

    const body = await response.arrayBuffer();

    await store.put(key, new Response(body.slice(0), { status: 200, headers })).catch(() => undefined);

    return new Response(body, { status: 200, headers: response.headers });
  };
}

/** Cache API Workera (`caches.default`); null poza Workerem. */
export function workersResponseStore(): ResponseStore | null {
  const storage: unknown = (globalThis as Record<string, unknown>).caches;
  const cache: unknown = storage ? (storage as Record<string, unknown>).default : undefined;

  if (!cache || typeof (cache as ResponseStore).match !== 'function') return null;

  const typed = cache as ResponseStore;

  return {
    match: (key) => typed.match(key),
    put: (key, response) => typed.put(key, response),
  };
}

/** Pamiec w procesie (testy): honoruje `max-age` wzgledem podanego zegara. */
export function memoryResponseStore(now: () => number = Date.now): ResponseStore & { size(): number } {
  const entries = new Map<string, { body: ArrayBuffer; headers: [string, string][]; expiresAt: number }>();

  return {
    match(key) {
      const entry = entries.get(key);

      if (!entry || entry.expiresAt <= now()) return Promise.resolve(undefined);

      return Promise.resolve(new Response(entry.body.slice(0), { status: 200, headers: entry.headers }));
    },
    async put(key, response) {
      const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 0);

      entries.set(key, {
        body: await response.arrayBuffer(),
        headers: [...response.headers.entries()],
        expiresAt: now() + maxAge * 1000,
      });
    },
    size: () => entries.size,
  };
}
