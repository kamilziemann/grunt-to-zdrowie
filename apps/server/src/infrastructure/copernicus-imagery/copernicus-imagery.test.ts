import { describe, expect, it } from 'vitest';

import type { VegetationImageRequest } from '../../domain/vegetation-imagery';
import {
  COPERNICUS_CATALOG_URL,
  COPERNICUS_PROCESS_URL,
  COPERNICUS_STATISTICS_URL,
  COPERNICUS_TOKEN_URL,
  combineStats,
  createCopernicusImagerySource,
  imageSize,
  mapLimit,
  ndviScale,
  parseCatalog,
  parseFieldStats,
  type FetchLike,
} from './copernicus-imagery';
import {
  CATALOG_RESPONSE,
  PNG_BYTES,
  STATS_CLEAR,
  STATS_CLOUDY,
  STATS_EMPTY,
  TOKEN_RESPONSE,
} from './copernicus-imagery.fixtures';

const PART = {
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.589876, 52.17167],
        [21.590427, 52.172262],
        [21.589332, 52.171852],
        [21.589876, 52.17167],
      ],
    ],
  },
  bbox: [21.5893, 52.1716, 21.5905, 52.1723],
} satisfies VegetationImageRequest['parts'][number];

const REQUEST: VegetationImageRequest = { parts: [PART], date: '2025-07-01', windowDays: 30 };

interface Call {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Fake uslugi: odpowiedzi po adresie, statystyki kolejno dla kolejnych kandydatow. */
function fakeCopernicus(stats: unknown[], calls: Call[] = []): FetchLike {
  const queue = [...stats];

  return (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });

    if (url === COPERNICUS_TOKEN_URL) return Promise.resolve(Response.json(TOKEN_RESPONSE));

    if (url === COPERNICUS_CATALOG_URL) return Promise.resolve(Response.json(CATALOG_RESPONSE));

    if (url === COPERNICUS_STATISTICS_URL)
      return Promise.resolve(Response.json(queue.shift() ?? STATS_EMPTY));

    if (url === COPERNICUS_PROCESS_URL) return Promise.resolve(new Response(PNG_BYTES));

    return Promise.resolve(new Response('', { status: 404 }));
  };
}

describe('parseCatalog', () => {
  it('jedna scena na dzien (lepszy przelot), bez zachmurzonych w calosci, od najczystszej', () => {
    expect(parseCatalog(CATALOG_RESPONSE)).toEqual([
      { date: '2025-06-15', cloudCover: 0 },
      { date: '2025-06-30', cloudCover: 9.43 },
      { date: '2025-06-14', cloudCover: 18.22 },
      { date: '2025-06-22', cloudCover: 42.66 },
      { date: '2025-06-17', cloudCover: 75.85 },
    ]);
  });

  it('odpowiedz bez listy scen to blad', () => {
    expect(() => parseCatalog({ error: 'x' })).toThrow('no features');
  });
});

describe('parseFieldStats', () => {
  it('czesc pola bez chmur liczy tylko piksele w geometrii', () => {
    expect(parseFieldStats(STATS_CLEAR)).toMatchObject({
      fieldPixels: 48,
      clearPixels: 48,
      low: 0.7332465648651123,
    });
    expect(parseFieldStats(STATS_CLOUDY)).toMatchObject({ fieldPixels: 48, clearPixels: 16 });
  });

  it('dzien bez danych = null', () => {
    expect(parseFieldStats(STATS_EMPTY)).toBeNull();
  });
});

describe('ndviScale i imageSize', () => {
  it('waski zakres pola rozszerza sie symetrycznie do minimalnej rozpietosci', () => {
    const scale = ndviScale({ low: 0.73, high: 0.86 });

    expect(scale.high - scale.low).toBeCloseTo(0.2, 6);
    expect((scale.low + scale.high) / 2).toBeCloseTo(0.795, 6);
    expect(ndviScale({ low: 0.2, high: 0.7 })).toEqual({ low: 0.2, high: 0.7 });
  });

  it('obraz ma proporcje zasiegu w metrach', () => {
    // 0,01 stopnia dlugosci na 52 st. szerokosci to ok. 0,616 stopnia szerokosci w metrach
    const { width, height } = imageSize([21, 52, 21.01, 52.01]);

    expect(height).toBe(512);
    expect(width / height).toBeCloseTo(Math.cos((52.005 * Math.PI) / 180), 2);
  });
});

describe('mapLimit', () => {
  it('zachowuje kolejnosc i nie przekracza limitu', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;

      return value * 10;
    });

    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('combineStats', () => {
  it('pole z dzialek: czesc bez chmur z sumy pikseli, percentyle wazone czystymi pikselami', () => {
    const clear = parseFieldStats(STATS_CLEAR);
    const cloudy = parseFieldStats(STATS_CLOUDY);
    const combined = combineStats([clear, cloudy]);

    expect(combined?.clearShare).toBeCloseTo((48 + 16) / 96, 6);
    expect(combined?.low).toBeCloseTo((0.7332465648651123 * 48 + 0.2 * 16) / 64, 6);
    expect(combineStats([clear, null])).toBeNull();
  });
});

describe('createCopernicusImagerySource', () => {
  it('pomija scene z chmura nad polem i rysuje pierwsza czysta', async () => {
    const calls: Call[] = [];
    const image = await createCopernicusImagerySource(
      { clientId: 'id', clientSecret: 'secret' },
      fakeCopernicus([STATS_CLOUDY, STATS_CLEAR], calls),
    ).render(REQUEST);

    expect(image).toMatchObject({ sceneDate: '2025-06-30', clearShare: 1 });
    expect(image?.tiles).toEqual([{ png: PNG_BYTES, bbox: PART.bbox }]);

    const process = calls.find((call) => call.url === COPERNICUS_PROCESS_URL);
    const catalog = calls.find((call) => call.url === COPERNICUS_CATALOG_URL);

    expect(process?.headers.authorization).toBe('Bearer token-1');
    expect(process?.body).toContain('2025-06-30T00:00:00Z');
    expect(JSON.parse(catalog?.body ?? '{}')).toMatchObject({
      datetime: '2025-06-01T00:00:00Z/2025-07-01T23:59:59Z',
    });
  });

  it('token zostaje w pamieci do wygasniecia', async () => {
    const calls: Call[] = [];
    const source = createCopernicusImagerySource(
      { clientId: 'cache-test', clientSecret: 'secret' },
      fakeCopernicus([STATS_CLEAR, STATS_CLEAR], calls),
    );

    await source.render(REQUEST);
    await source.render(REQUEST);

    expect(calls.filter((call) => call.url === COPERNICUS_TOKEN_URL)).toHaveLength(1);
  });

  it('brak czystej sceny = null', async () => {
    const source = createCopernicusImagerySource(
      { clientId: 'id', clientSecret: 'secret' },
      fakeCopernicus([STATS_CLOUDY, STATS_CLOUDY, STATS_EMPTY, STATS_CLOUDY]),
    );

    await expect(source.render(REQUEST)).resolves.toBeNull();
  });

  it('po 429 czeka i ponawia', async () => {
    const waits: number[] = [];
    let limited = 1;
    const base = fakeCopernicus([STATS_CLEAR]);
    const fetchImpl: FetchLike = (url, init) => {
      if (url === COPERNICUS_STATISTICS_URL && limited > 0) {
        limited -= 1;

        return Promise.resolve(new Response('', { status: 429, headers: { 'retry-after': '1788' } }));
      }

      return base(url, init);
    };
    const source = createCopernicusImagerySource(
      { clientId: 'retry', clientSecret: 's' },
      fetchImpl,
      Date.now,
      (ms) => {
        waits.push(ms);

        return Promise.resolve();
      },
    );

    await expect(source.render(REQUEST)).resolves.toMatchObject({ sceneDate: '2025-06-15' });
    expect(waits).toEqual([1788]);
  });

  it('brak kluczy = not_configured, blad uslugi = upstream_failed', async () => {
    await expect(createCopernicusImagerySource({}).render(REQUEST)).rejects.toMatchObject({
      code: 'not_configured',
    });

    const failing: FetchLike = () => Promise.resolve(new Response('', { status: 500 }));

    await expect(
      createCopernicusImagerySource({ clientId: 'failing', clientSecret: 's' }, failing).render(REQUEST),
    ).rejects.toMatchObject({ code: 'upstream_failed' });
  });
});
