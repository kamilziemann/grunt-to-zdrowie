import { describe, expect, it } from 'vitest';

import {
  createMetNorwayForecastSource,
  forecastIssuedAt,
  metNorwayUrl,
  parseForecast,
  type FetchLike,
} from './meteo-met-norway';
import recorded from './met-norway.recorded.json?raw';

// Nagranie: prognoza compact dla 52,17 N 21,56 E wydana 21.11.2026 ok. 19 UTC (kroki godzinowe przez ok. 2,5 doby,
// potem co 6 godzin, ostatni krok 1.12.2026).
const BODY: unknown = JSON.parse(recorded);
const POINT: [number, number] = [21.56, 52.17];

const step = (time: string, temp: number, next1: number | null, next6: number | null) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp } },
    ...(next1 === null ? {} : { next_1_hours: { details: { precipitation_amount: next1 } } }),
    ...(next6 === null ? {} : { next_6_hours: { details: { precipitation_amount: next6 } } }),
  },
});

describe('parseForecast', () => {
  it('sumuje rozlaczne przedzialy opadu: godzinowe, potem 6-godzinne, bez liczenia podwojnego', () => {
    // 22.11 w Polsce = 21.11 23:00 UTC .. 22.11 23:00 UTC
    const hourly = [
      '2026-11-21T23:00:00Z',
      '2026-11-22T00:00:00Z',
      '2026-11-22T01:00:00Z',
      '2026-11-22T02:00:00Z',
      '2026-11-22T03:00:00Z',
      '2026-11-22T04:00:00Z',
    ].map((time) => step(time, 2, 0.5, 9));
    const sixHourly = ['05', '11', '17'].map((hour) => step(`2026-11-22T${hour}:00:00Z`, 4, null, 2));
    const days = parseForecast(
      { properties: { timeseries: [...hourly, ...sixHourly] } },
      '2026-11-21',
      1,
      52,
    );

    expect(days).toHaveLength(1);
    // 6 x 0,5 mm z godzin + 3 x 2 mm z przedzialow 6 h; 6-godzinna suma z kroku godzinowego nie wchodzi
    expect(days[0]).toMatchObject({ date: '2026-11-22', precipMm: 9, tMinC: 2, tMaxC: 4 });
    expect(days[0]?.et0Mm).toBeGreaterThanOrEqual(0);
  });

  it('nagrana prognoza daje 7 kolejnych dob po dacie analizy z opadem, temperaturami i ET0', () => {
    const days = parseForecast(BODY, '2026-11-21', 7, POINT[1]);

    expect(days.map((day) => day.date)).toEqual([
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ]);

    for (const day of days) {
      expect(day.precipMm).toBeGreaterThanOrEqual(0);
      expect(day.tMaxC).toBeGreaterThanOrEqual(day.tMinC ?? Number.NaN);
      expect(day.et0Mm).toBeGreaterThanOrEqual(0);
    }
  });

  it('odpowiedz bez timeseries to blad formatu', () => {
    expect(() => parseForecast({}, '2026-11-21', 7, 52)).toThrow(/timeseries/);
  });
});

describe('createMetNorwayForecastSource', () => {
  it('przedstawia sie w User-Agent, zaokragla wspolrzedne do 4 miejsc i opisuje zrodlo', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, headers: init.headers });

      return Promise.resolve(new Response(JSON.stringify(BODY)));
    };
    const result = await createMetNorwayForecastSource({ fetch: fetchImpl }).forecast(
      [21.561_234_5, 52.171_234_5],
      '2026-11-21',
      7,
    );

    expect(calls[0]?.url).toBe(metNorwayUrl([21.561_234_5, 52.171_234_5]));
    expect(calls[0]?.url).toContain('lat=52.1712&lon=21.5612');
    expect(calls[0]?.headers['user-agent']).toContain('grunt-to-zdrowie');
    expect(result.source).toMatchObject({
      id: 'forecast',
      status: 'ok',
      sample: false,
      dataFrom: '2026-11-22',
    });
    expect(result.data?.days).toHaveLength(7);
    expect(result.data?.issuedAt).toBe('2026-11-21T19:18:50Z');
  });

  it('chwila wydania prognozy tylko z poprawnej daty', () => {
    expect(forecastIssuedAt(BODY)).toBe('2026-11-21T19:18:50Z');
    expect(forecastIssuedAt({ properties: { meta: { updated_at: 'wczoraj' } } })).toBeNull();
    expect(forecastIssuedAt({})).toBeNull();
  });

  it('za krotka prognoza = partial, blad HTTP = missing', async () => {
    const short = await createMetNorwayForecastSource({
      fetch: () => Promise.resolve(new Response(JSON.stringify(BODY))),
    }).forecast(POINT, '2026-11-21', 14);
    const down = await createMetNorwayForecastSource({
      fetch: () => Promise.resolve(new Response('', { status: 503 })),
    }).forecast(POINT, '2026-11-21', 7);

    expect(short.source.status).toBe('partial');
    expect(down).toMatchObject({
      data: null,
      source: { status: 'missing', note: expect.stringContaining('503') },
    });
  });
});
