// Pamiec dzialek w D1 (miniflare z migracjami): zapis, odczyt i nadpisanie wiersza oraz /parcels/by-id, ktore po
// pierwszym pobraniu odpowiada z pamieci, gdy GUGiK lezy.
import { createDb } from '@app/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { ParcelSource } from '../../src/domain/parcel-source';
import { withParcelMemory } from '../../src/infrastructure/parcel-memory';
import { createParcelRecordsRepository } from '../../src/repositories/parcel-records';
import { referenceParcelSource, REGULAR_FIELD } from '../fixtures/reference-fields';
import { makeApp } from '../helpers';

describe('pamiec dzialek (D1)', () => {
  it('zapisuje, odczytuje i nadpisuje dzialke z klasouzytkami', async () => {
    const store = createParcelRecordsRepository(createDb(env.DB));
    const base = {
      id: 'x_1.0001.1',
      number: '1',
      region: 'Obręb',
      commune: 'Gmina',
      county: 'Powiat',
      voivodeship: 'mazowieckie',
      geometry: { type: 'Polygon' as const, coordinates: [] },
      origin: 'egib-wfs' as const,
      landUse: ['RIVb', 'ŁV'],
      registryAreaHa: 1.23,
      fetchedAt: '2026-11-01T00:00:00.000Z',
    };

    expect(await store.get(base.id)).toBeNull();

    await store.put(base.id, base);
    expect(await store.get(base.id)).toEqual(base);

    const { landUse: _, registryAreaHa: __, ...uldk } = base;

    await store.put(base.id, { ...uldk, origin: 'uldk', fetchedAt: '2026-11-22T00:00:00.000Z' });
    expect(await store.get(base.id)).toEqual({
      ...uldk,
      origin: 'uldk',
      fetchedAt: '2026-11-22T00:00:00.000Z',
    });
  });

  it('/parcels/by-id odpowiada z pamieci, gdy GUGiK przestal odpowiadac', async () => {
    const reference = referenceParcelSource;
    const state = { down: false };
    const gugik: ParcelSource = {
      byId: (id) => (state.down ? Promise.reject(new Error('ULDK 302')) : reference.byId(id)),
      byPoint: (lng, lat) => reference.byPoint(lng, lat),
      byName: (query, limit) => reference.byName(query, limit),
    };
    const parcelSource = withParcelMemory(gugik, {
      store: createParcelRecordsRepository(createDb(env.DB)),
      now: () => '2026-11-22T02:00:00.000Z',
    });
    const app = makeApp({ parcelSource });
    const path = `/parcels/by-id?${new URLSearchParams({ id: REGULAR_FIELD.id }).toString()}`;

    expect((await app.request(path)).status).toBe(200);

    state.down = true;

    const fromMemory = await app.request(path);

    expect(fromMemory.status).toBe(200);
    expect(await fromMemory.json()).toMatchObject({ id: REGULAR_FIELD.id });
  });
});
