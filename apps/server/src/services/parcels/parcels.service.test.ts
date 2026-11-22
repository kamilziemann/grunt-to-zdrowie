import { describe, expect, it } from 'vitest';

import { createParcelsService } from './parcels.service';
import type { ParcelRecord, ParcelSource } from './ports';

const RECORD: ParcelRecord = {
  id: '141201_1.0001.6509',
  number: '6509',
  region: 'Mińsk Mazowiecki',
  commune: 'Mińsk Mazowiecki (miasto)',
  county: 'powiat miński',
  voivodeship: 'mazowieckie',
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

function fakeSource(overrides: Partial<ParcelSource> = {}): ParcelSource & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    byId: (id) => {
      calls.push(`byId:${id}`);

      return Promise.resolve(id === RECORD.id ? RECORD : null);
    },
    byPoint: () => Promise.resolve(null),
    byName: (query) => {
      calls.push(`byName:${query}`);

      return Promise.resolve({ total: 61, items: [RECORD] });
    },
    ...overrides,
  };
}

const now = () => '2026-11-21T12:00:00.000Z';
const outlines = {
  inBounds: () =>
    Promise.resolve({
      truncated: false,
      items: [{ id: RECORD.id, number: '6509', geometry: RECORD.geometry }],
    }),
};

describe('parcels service', () => {
  it('dolicza bbox, srodek i powierzchnie w hektarach', async () => {
    const parcel = await createParcelsService({ source: fakeSource(), outlines, now }).get(RECORD.id);

    expect(parcel).toMatchObject({ id: RECORD.id, source: 'uldk', fetchedAt: now() });
    expect(parcel.bbox).toEqual([21, 52, 21.001456, 52.000899]);
    expect(parcel.areaHa).toBeCloseTo(1, 1);
    expect(parcel.centroid[0]).toBeCloseTo(21.000728, 5);
  });

  it('dzialka z pamieci niesie date pobrania z GUGiK i znacznik przeterminowania', async () => {
    const remembered = { ...RECORD, fetchedAt: '2026-10-01T08:00:00.000Z', stale: true };
    const source = fakeSource({ byId: () => Promise.resolve(remembered) });
    const parcel = await createParcelsService({ source, outlines, now }).get(RECORD.id);

    expect(parcel).toMatchObject({ fetchedAt: '2026-10-01T08:00:00.000Z', stale: true });
    expect((await createParcelsService({ source: fakeSource(), outlines, now }).get(RECORD.id)).stale).toBe(
      undefined,
    );
  });

  it('brak dzialki = not_found', async () => {
    const service = createParcelsService({ source: fakeSource(), outlines, now });

    await expect(service.get('999999_9.9999.1')).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.at(21, 52)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('granice kafla niosa numer, geometrie i punkt na podpis', async () => {
    const result = await createParcelsService({ source: fakeSource(), outlines, now }).boundaries(
      36_697,
      21_617,
    );

    expect(result.truncated).toBe(false);
    expect(result.items[0]).toMatchObject({ id: RECORD.id, number: '6509' });
    expect(result.items[0]?.center[0]).toBeCloseTo(21.000728, 5);
  });

  it('kafel z14 pyta o czterokrotnie dluzszy bok niz kafel z16 i przekazuje flage obciecia', async () => {
    const asked: number[][] = [];
    const truncating = {
      inBounds: (bounds: [number, number, number, number]) => {
        asked.push(bounds);

        return Promise.resolve({ truncated: true, items: [] });
      },
    };
    const service = createParcelsService({ source: fakeSource(), outlines: truncating, now });

    const coarse = await service.boundaries(9174, 5404, 14);

    await service.boundaries(36_697, 21_617);

    const [z14, z16] = asked;

    expect(coarse.truncated).toBe(true);
    expect(((z14?.[2] ?? 0) - (z14?.[0] ?? 0)) / ((z16?.[2] ?? 0) - (z16?.[0] ?? 1))).toBeCloseTo(4, 5);
  });

  it('pelny identyfikator szuka po id, a nazwa obrebu po nazwie', async () => {
    const source = fakeSource();
    const service = createParcelsService({ source, outlines, now });

    const byId = await service.search(RECORD.id);
    const missing = await service.search('999999_9.9999.1');
    const byName = await service.search('Dąbrowa 12');

    expect(byId).toEqual({
      total: 1,
      items: [expect.objectContaining({ id: RECORD.id, commune: RECORD.commune })],
    });
    expect(byId.items[0]).not.toHaveProperty('geometry');
    expect(missing).toEqual({ total: 0, items: [] });
    expect(byName.total).toBe(61);
    expect(source.calls).toEqual([`byId:${RECORD.id}`, 'byId:999999_9.9999.1', 'byName:Dąbrowa 12']);
  });
});
