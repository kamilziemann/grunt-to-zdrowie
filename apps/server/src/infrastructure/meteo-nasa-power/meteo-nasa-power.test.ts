import { describe, expect, it } from 'vitest';

import {
  createNasaPowerMeteoSource,
  parsePower,
  powerUrl,
  type FetchLike,
  nasaPowerCacheTtl,
} from './meteo-nasa-power';
import recorded from './nasa-power.recorded.json?raw';

// Nagranie: punkt 52,17 N 21,56 E (Minsk Mazowiecki), 10-21 listopada 2026, pobrane 21.11.2026 - ostatnie trzy dni
// i promieniowanie z ostatnich szesciu dni sa jeszcze puste (-999), tak jak w prawdziwej analizie "na dzis".
const BODY: unknown = JSON.parse(recorded);
const POINT: [number, number] = [21.56, 52.17];

const respond =
  (body: unknown, status = 200): FetchLike =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('parsePower', () => {
  it('zamienia -999 na brak, zostawia dni z luka w ciaglej serii i mowi, ze dane sa czesciowe', () => {
    const parsed = parsePower(BODY, '2026-11-10', '2026-11-21');

    expect(parsed.data?.days).toHaveLength(12);
    expect(parsed.data?.days[0]).toEqual({
      date: '2026-11-10',
      precipMm: 5.92,
      tMinC: -3.44,
      tMaxC: 3.88,
      tMeanC: -0.07,
      et0Mm: null,
      solarMjM2: 2.88,
      humidityPct: 86.75,
      windMs: 2.15,
    });
    expect(parsed.data?.days[6]?.solarMjM2).toBeNull();
    expect(parsed.data?.days[11]).toMatchObject({ date: '2026-11-21', precipMm: null, tMaxC: null });
    expect(parsed.data?.elevationM).toBeCloseTo(125.44, 2);
    expect(parsed).toMatchObject({ status: 'partial', dataFrom: '2026-11-10', dataTo: '2026-11-18' });
    expect(parsed.note).toContain('3 z 12 dni bez opadu');
    expect(parsed.note).toContain('Hargreaves');
  });

  it('pelna seria ma status ok, a sama luka - missing z powodem', () => {
    expect(parsePower(BODY, '2026-11-10', '2026-11-15')).toMatchObject({ status: 'ok' });
    expect(parsePower(BODY, '2026-11-19', '2026-11-21')).toMatchObject({ status: 'missing', data: null });
    expect(() => parsePower({ messages: [] }, '2026-11-10', '2026-11-11')).toThrow(/parameter/);
  });
});

describe('createNasaPowerMeteoSource', () => {
  it('pyta o profil AG w czasie lokalnym i opisuje zrodlo (licencja, zakres, rozdzielczosc)', async () => {
    const urls: string[] = [];
    const source = createNasaPowerMeteoSource({
      fetch: (url, init) => {
        urls.push(url);

        return respond(BODY)(url, init);
      },
      now: () => '2026-11-21T12:00:00.000Z',
    });
    const result = await source.series(POINT, '2026-11-10', '2026-11-21');

    expect(urls[0]).toBe(powerUrl(POINT, '2026-11-10', '2026-11-21'));
    expect(urls[0]).toContain('community=AG');
    expect(urls[0]).toContain('time-standard=LST');
    expect(urls[0]).toContain('start=20261110');
    expect(result.source).toMatchObject({
      id: 'meteo',
      status: 'partial',
      sample: false,
      licence: expect.stringContaining('CC BY 4.0'),
      dataFrom: '2026-11-10',
      dataTo: '2026-11-18',
      fetchedAt: '2026-11-21T12:00:00.000Z',
    });
    expect(result.data?.gridKm).toBe(55);
  });

  it('blad HTTP albo sieci to odpowiedz missing, nie wyjatek', async () => {
    const http = await createNasaPowerMeteoSource({ fetch: respond({ detail: 'bad' }, 422) }).series(
      POINT,
      '2026-11-10',
      '2026-11-11',
    );
    const network = await createNasaPowerMeteoSource({
      fetch: () => Promise.reject(new Error('connection reset')),
    }).series(POINT, '2026-11-10', '2026-11-11');

    expect(http).toMatchObject({
      data: null,
      source: { status: 'missing', note: expect.stringContaining('422') },
    });
    expect(network).toMatchObject({
      data: null,
      source: { status: 'missing', note: 'NASA POWER: błąd połączenia (connection reset)' },
    });
  });
});

describe('nasaPowerCacheTtl', () => {
  it('seria konczaca sie w historii - 30 dni, konczaca sie dzis - 3 h', () => {
    const ttl = nasaPowerCacheTtl(() => '2026-11-21');

    expect(ttl(powerUrl([21.56, 52.17], '2008-01-01', '2018-06-15'))).toBe(30 * 24 * 3600);
    expect(ttl(powerUrl([21.56, 52.17], '2016-01-01', '2026-11-21'))).toBe(3 * 3600);
  });
});
