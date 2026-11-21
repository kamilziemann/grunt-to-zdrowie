import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fieldFromGeometry } from '../../domain/field-area';
import recorded from './cdse-statistics.recorded.json?raw';
import { floatTiff } from '../../../test/fixtures/float-tiff';
import {
  CDSE_PROCESS_URL,
  CDSE_STATISTICS_URL,
  CDSE_TOKEN_URL,
  createSentinelStatisticsSource,
  parseRaster,
  parseStatistics,
  rasterBody,
  rasterSize,
  rasterWindow,
  statisticsBody,
  windowsFor,
  type FetchLike,
  sentinelCacheTtl,
} from './sentinel-statistics';

// Nagranie: API statystyk CDSE (Sentinel-2 L2A, NDVI/NDMI z maska SCL 4-5) dla prostokata ok. 205 x 167 m od
// 52,17 N 21,56 E, 16.06-15.07.2021, pobrane 21.11.2026: 12 dni ze scena, czesc w calosci pod chmurami
// (noDataCount = sampleCount, srednia "NaN"), 28.06 prawie cala zachmurzona (9 z 600 pikseli czystych).
const BODY: unknown = JSON.parse(recorded);

const field: FieldArea = fieldFromGeometry({
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.56, 52.17],
        [21.563, 52.17],
        [21.563, 52.1715],
        [21.56, 52.1715],
        [21.56, 52.17],
      ],
    ],
  },
  kind: 'drawn',
  parcelIds: [],
});

/** Cialo zapytania - adapter wysyla zawsze napis (JSON albo formularz). */
const bodyOf = (init: RequestInit): string => (typeof init.body === 'string' ? init.body : '');

interface Call {
  url: string;
  body: string;
}

function replay(
  calls: Call[],
  token: Response = Response.json({ access_token: 'token-1', expires_in: 1800 }),
): FetchLike {
  return (url, init) => {
    calls.push({ url, body: bodyOf(init) });

    if (url === CDSE_TOKEN_URL) return Promise.resolve(token.clone());

    if (url === CDSE_PROCESS_URL) {
      // raster pola: NDVI 0,7 i NDMI 0,3 w kazdym pikselu siatki z zapytania
      const { output } = JSON.parse(bodyOf(init)) as { output: { width: number; height: number } };
      const pixels = Array.from({ length: output.width * output.height }, () => [0.7, 0.3]).flat();

      return Promise.resolve(new Response(floatTiff(output.width, output.height, 2, pixels)));
    }

    // to samo nagranie w kazdym oknie, przesuniete na rok, o ktory pyta zapytanie
    const year = /"from":"(\d{4})-/.exec(bodyOf(init))?.[1] ?? '2021';

    return Promise.resolve(Response.json(JSON.parse(recorded.replaceAll('"2021-', `"${year}-`))));
  };
}

describe('parseStatistics', () => {
  it('zostawia dni z co najmniej 60% czystych pikseli; srednie zaokraglone, udzial i liczba pikseli', () => {
    const observations = parseStatistics(BODY);

    expect(observations.map((item) => item.date)).toEqual([
      '2021-06-16',
      '2021-06-18',
      '2021-06-21',
      '2021-06-23',
      '2021-06-26',
      '2021-07-08',
      '2021-07-11',
    ]);
    expect(observations[0]).toEqual({
      date: '2021-06-16',
      ndvi: 0.441,
      ndmi: 0.177,
      validShare: 1,
      pixels: 600,
    });
    expect(observations[3]).toMatchObject({ pixels: 507, validShare: 0.84 });
  });
});

describe('windowsFor i zapytanie', () => {
  it('30 dni do daty analizy i +-10 dni tej samej pory w latach od 2017', () => {
    expect(windowsFor('2021-07-15')).toEqual([
      { from: '2021-06-16', to: '2021-07-15', year: null },
      { from: '2020-07-05', to: '2020-07-25', year: 2020 },
      { from: '2019-07-05', to: '2019-07-25', year: 2019 },
      { from: '2018-07-05', to: '2018-07-25', year: 2018 },
      { from: '2017-07-05', to: '2017-07-25', year: 2017 },
    ]);
    expect(windowsFor('2026-11-21')).toHaveLength(6);
  });

  it('raster w pikselach 10 m z prostokata pola i geometria pola w CRS84', () => {
    expect(rasterSize(field.bbox)).toEqual({ width: 20, height: 17 });
    expect(statisticsBody(field, { from: '2021-06-16', to: '2021-07-15', year: null })).toMatchObject({
      input: { bounds: { geometry: field.geometry }, data: [{ type: 'sentinel-2-l2a' }] },
      aggregation: {
        timeRange: { from: '2021-06-16T00:00:00Z', to: '2021-07-15T23:59:59Z' },
        aggregationInterval: { of: 'P1D' },
      },
    });
  });
});

describe('raster pola (Process API)', () => {
  it('okno zdjec: 30 dni w sezonie, poza sezonem lato poprzedniego sezonu', () => {
    expect(rasterWindow('2021-07-15')).toEqual({ from: '2021-06-16', to: '2021-07-15' });
    expect(rasterWindow('2021-11-20')).toEqual({ from: '2021-06-01', to: '2021-08-31' });
    expect(rasterWindow('2022-02-10')).toEqual({ from: '2021-06-01', to: '2021-08-31' });
  });

  it('zapytanie na siatke komorek w UTM (piksel w piksel) i odczyt dwoch warstw; chmury ponad polowe = brak', async () => {
    const spec = { zone: 34, epsg: 32_634, west: 600_000, north: 5_780_020, cellSizeM: 10, cols: 2, rows: 2 };
    const window = { from: '2021-06-16', to: '2021-07-15' };

    expect(rasterBody(spec, window)).toMatchObject({
      input: {
        bounds: {
          bbox: [600_000, 5_780_000, 600_020, 5_780_020],
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/32634' },
        },
        data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }],
      },
      output: { width: 2, height: 2 },
    });

    const clear = await parseRaster(
      floatTiff(2, 2, 2, [0.5, 0.2, 0.6, 0.25, 0.7, 0.3, Number.NaN, Number.NaN]),
      spec,
      window,
    );
    const cloudy = await parseRaster(
      floatTiff(2, 2, 2, [0.5, 0.2, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN]),
      spec,
      window,
    );

    expect(clear).toMatchObject({ ndvi: [0.5, 0.6, 0.7, Number.NaN], ndmi: [0.2, 0.25, 0.3, Number.NaN] });
    expect(cloudy).toBeNull();
  });
});

describe('createSentinelStatisticsSource', () => {
  it('token client_credentials, jedno zapytanie na okno, obserwacje od najnowszej, rok bazowy najblizej rocznicy', async () => {
    const calls: Call[] = [];
    const source = createSentinelStatisticsSource({
      clientId: 'id',
      clientSecret: 'secret',
      fetch: replay(calls),
      now: () => '2026-11-21T12:00:00Z',
    });
    const result = await source.series(field, '2021-07-15');

    expect(calls[0]).toMatchObject({ url: CDSE_TOKEN_URL });
    expect(calls[0]?.body).toContain('grant_type=client_credentials');
    expect(calls.filter((call) => call.url === CDSE_STATISTICS_URL)).toHaveLength(5);
    expect(calls.filter((call) => call.url === CDSE_PROCESS_URL)).toHaveLength(1);
    expect(result.data?.raster).toMatchObject({
      epsg: 32_634,
      cellSizeM: 10,
      from: '2021-06-16',
      to: '2021-07-15',
    });
    expect(result.data?.raster?.ndmi.every((value) => value === 0.3)).toBe(true);
    expect(result.data?.observations[0]?.date).toBe('2021-07-11');
    // w kazdym roku najblizej 15 lipca jest scena z 11 lipca
    expect(result.data?.baseline.map((item) => [item.year, item.date])).toEqual([
      [2020, '2020-07-11'],
      [2019, '2019-07-11'],
      [2018, '2018-07-11'],
      [2017, '2017-07-11'],
    ]);
    expect(result.source).toMatchObject({
      id: 'vegetation',
      status: 'ok',
      sample: false,
      dataFrom: '2017-07-05',
      dataTo: '2021-07-15',
    });
    expect(JSON.stringify(result.source)).not.toContain('secret');
  });

  it('brak kluczy, data przed 2017, odmowa tokenu i blad sieci to `missing` z powodem', async () => {
    const field2 = field;
    const noKeys = await createSentinelStatisticsSource({
      clientId: undefined,
      clientSecret: undefined,
    }).series(field2, '2021-07-15');
    const early = await createSentinelStatisticsSource({
      clientId: 'id',
      clientSecret: 's',
      fetch: replay([]),
    }).series(field2, '2016-12-01');
    const denied = await createSentinelStatisticsSource({
      clientId: 'id',
      clientSecret: 's',
      fetch: replay([], new Response('unauthorized', { status: 401 })),
    }).series(field2, '2021-07-15');
    const offline = await createSentinelStatisticsSource({
      clientId: 'id',
      clientSecret: 's',
      fetch: () => Promise.reject(new Error('network down')),
    }).series(field2, '2021-07-15');

    expect([noKeys, early, denied, offline].map((result) => [result.data, result.source.status])).toEqual([
      [null, 'missing'],
      [null, 'missing'],
      [null, 'missing'],
      [null, 'missing'],
    ]);
    expect(noKeys.source.note).toContain('COPERNICUS_CLIENT_ID');
    expect(early.source.note).toContain('2017');
    expect(denied.source.note).toContain('401');
    expect(offline.source.note).toContain('network down');
  });

  it('HTTP 429: jedna ponowna proba; odmowa dla czesci lat zostawia reszte (status `partial`)', async () => {
    let statistics = 0;
    const limited: FetchLike = (url, init) => {
      if (url === CDSE_TOKEN_URL) return Promise.resolve(Response.json({ access_token: 't' }));

      statistics += 1;

      // pierwsze zapytanie odbija sie raz od limitu, a rok 2017 jest odrzucany zawsze
      if (statistics === 1 || bodyOf(init).includes('"from":"2017-')) {
        return Promise.resolve(
          new Response('slow down', { status: 429, headers: { 'retry-after': '0.01' } }),
        );
      }

      return Promise.resolve(Response.json(BODY));
    };
    const result = await createSentinelStatisticsSource({
      clientId: 'id',
      clientSecret: 's',
      fetch: limited,
    }).series(field, '2021-07-15');

    expect(result.data?.observations).toHaveLength(7);
    expect(result.data?.baseline.map((item) => item.year)).toEqual([2020, 2019, 2018]);
    expect(result.source.status).toBe('partial');
    expect(result.source.note).toContain('1 z 5 zapytań odrzuconych (HTTP 429)');
  });

  it('brak czystej sceny w 30 dniach: dane z lat poprzednich zostaja, status `partial`', async () => {
    const cloudy: FetchLike = (url) =>
      Promise.resolve(
        url === CDSE_TOKEN_URL ? Response.json({ access_token: 't' }) : Response.json({ data: [] }),
      );
    const result = await createSentinelStatisticsSource({
      clientId: 'id',
      clientSecret: 's',
      fetch: cloudy,
    }).series(field, '2021-07-15');

    expect(result.data).toEqual({ observations: [], baseline: [], cellSizeM: 10 });
    expect(result.source.status).toBe('partial');
    expect(result.source.note).toContain('brak bezchmurnego zdjęcia');
  });
});

describe('sentinelCacheTtl', () => {
  it('token 5 min, archiwum 30 dni, okno konczace sie w ostatnich dniach 3 h', () => {
    const ttl = sentinelCacheTtl(() => '2026-11-21');
    const window = (to: string) => ({
      method: 'POST',
      body: JSON.stringify({ aggregation: { timeRange: { to: `${to}T23:59:59Z` } } }),
    });

    expect(ttl(CDSE_TOKEN_URL, { method: 'POST', body: 'grant_type=client_credentials' })).toBe(300);
    expect(ttl(CDSE_STATISTICS_URL, window('2021-07-15'))).toBe(30 * 24 * 3600);
    expect(ttl(CDSE_STATISTICS_URL, window('2026-11-21'))).toBe(3 * 3600);
  });
});
