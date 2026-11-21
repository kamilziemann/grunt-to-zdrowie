// Pelny przeplyw request -> handler -> serwis dla /parcels z dzialkami w pamieci zamiast ULDK (testy nie wolaja
// zewnetrznych uslug): walidacja wejscia, 404, 502 i naglowki cache'u brzegowego.
import { AppError } from '@app/http';
import { describe, expect, it } from 'vitest';

import type { ParcelOutlineSource } from '../../src/domain/parcel-outline-source';
import type { ParcelRecord, ParcelSource } from '../../src/domain/parcel-source';
import { makeApp } from '../helpers';

const RECORD: ParcelRecord = {
  id: '141201_1.0001.12/3',
  number: '12/3',
  region: 'Dąbrowa',
  commune: 'Krośnice',
  county: 'powiat milicki',
  voivodeship: 'dolnośląskie',
  origin: 'uldk',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21, 52],
        [21.001456, 52],
        [21.001456, 52.000899],
        [21, 52.000899],
        [21, 52],
      ],
    ],
  },
};

const source: ParcelSource = {
  byId: (id) => {
    if (id === '999999_9.9999.500') return Promise.reject(AppError.upstream('ULDK', new Error('timeout')));

    return Promise.resolve(id === RECORD.id ? RECORD : null);
  },
  byPoint: (lng) => Promise.resolve(lng < 21.01 ? RECORD : null),
  byName: (_query, limit) => Promise.resolve({ total: 61, items: [RECORD].slice(0, limit) }),
};

const parcelOutlineSource: ParcelOutlineSource = {
  inBounds: ([west]) =>
    Promise.resolve({
      truncated: false,
      // kafel z16 36697/21617 zaczyna sie na 21,583 st., a obejmujacy go kafel z14 9174/5404 na 21,577 st. -
      // inne kafle sa puste
      items:
        west > 21.57 && west < 21.59
          ? [{ id: RECORD.id, number: RECORD.number, geometry: RECORD.geometry }]
          : [],
    }),
};

const app = makeApp({ parcelSource: source, parcelOutlineSource, now: () => '2026-11-21T12:00:00.000Z' });
const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

describe('/parcels', () => {
  it('oddaje dzialke z geometria po identyfikatorze z ukosnikiem', async () => {
    const res = await app.request(`/parcels/by-id?${query({ id: RECORD.id })}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: RECORD.id,
      number: '12/3',
      commune: 'Krośnice',
      geometry: { type: 'Polygon' },
      bbox: [21, 52, 21.001456, 52.000899],
      source: 'uldk',
      fetchedAt: '2026-11-21T12:00:00.000Z',
    });
  });

  it('publiczne odczyty ida z cache brzegowego z tagiem parcels', async () => {
    const res = await app.request(`/parcels/by-id?${query({ id: RECORD.id })}`);

    expect(res.headers.get('cache-control')).not.toContain('no-store');
    expect(res.headers.get('cache-tag')).toContain('parcels');
  });

  it('wyszukiwanie po nazwie oddaje kandydatow i laczna liczbe trafien', async () => {
    const res = await app.request(`/parcels/search?${query({ q: 'Dąbrowa 12' })}`);
    const body = await res.json<{ total: number; items: { id: string }[] }>();

    expect(res.status).toBe(200);
    expect(body.total).toBe(61);
    expect(body.items.map((item) => item.id)).toEqual([RECORD.id]);
    expect(body.items[0]).not.toHaveProperty('geometry');
  });

  it('dzialka pod punktem i 404, gdy w tym miejscu jej nie ma', async () => {
    const hit = await app.request(`/parcels/at?${query({ lng: '21.0005', lat: '52.0004' })}`);
    const miss = await app.request(`/parcels/at?${query({ lng: '21.5', lat: '52.0004' })}`);

    expect(hit.status).toBe(200);
    expect(await hit.json()).toMatchObject({ id: RECORD.id });
    expect(miss.status).toBe(404);
    expect(await miss.json()).toMatchObject({ code: 'not_found' });
    expect(miss.headers.get('cache-control')).toContain('no-store');
  });

  it('granice kafla: obrysy z numerem i punktem podpisu, zly kafel = 400', async () => {
    const hit = await app.request(`/parcels/boundaries?${query({ x: '36697', y: '21617' })}`);
    const empty = await app.request(`/parcels/boundaries?${query({ x: '1', y: '1' })}`);
    const invalid = await app.request(`/parcels/boundaries?${query({ x: '70000', y: '1' })}`);

    expect(hit.status).toBe(200);
    expect(await hit.json()).toMatchObject({
      truncated: false,
      items: [
        {
          id: RECORD.id,
          number: '12/3',
          geometry: { type: 'Polygon' },
          center: [expect.any(Number), expect.any(Number)],
        },
      ],
    });
    expect(hit.headers.get('cache-tag')).toContain('parcels');
    expect(await empty.json()).toEqual({ truncated: false, items: [] });
    expect(invalid.status).toBe(400);
  });

  it('granice kafla z14: poziom w adresie, inny poziom albo indeks spoza siatki z14 = 400', async () => {
    const coarse = await app.request(`/parcels/boundaries?${query({ x: '9174', y: '5404', z: '14' })}`);
    const wrongZoom = await app.request(`/parcels/boundaries?${query({ x: '9174', y: '5404', z: '13' })}`);
    const outside = await app.request(`/parcels/boundaries?${query({ x: '36697', y: '21617', z: '14' })}`);

    expect(coarse.status).toBe(200);
    expect(await coarse.json()).toMatchObject({ truncated: false, items: [{ id: RECORD.id }] });
    expect(coarse.headers.get('cache-tag')).toContain('parcels');
    expect(wrongZoom.status).toBe(400);
    expect(outside.status).toBe(400);
  });

  it('zle wejscie = 400 validation_failed', async () => {
    const statuses = [
      await app.request(`/parcels/by-id?${query({ id: 'Dąbrowa 12' })}`),
      await app.request(`/parcels/search?${query({ q: 'ab' })}`),
      await app.request(`/parcels/at?${query({ lng: '2.35', lat: '48.85' })}`),
    ].map((res) => res.status);

    expect(statuses).toEqual([400, 400, 400]);
  });

  it('brak dzialki = 404, awaria ULDK = 502 upstream_failed', async () => {
    const missing = await app.request(`/parcels/by-id?${query({ id: '141201_1.0001.1' })}`);
    const failed = await app.request(`/parcels/by-id?${query({ id: '999999_9.9999.500' })}`);

    expect(missing.status).toBe(404);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({ code: 'upstream_failed' });
  });
});
