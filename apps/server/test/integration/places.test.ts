// /places/search z geokoderem w pamieci (testy nie wolaja Nominatim): wynik, walidacja i cache brzegowy.
import { describe, expect, it } from 'vitest';

import type { PlaceSource } from '../../src/domain/place-source';
import { makeApp } from '../helpers';

const placeSource: PlaceSource = {
  search: (query, limit) =>
    Promise.resolve(
      [
        {
          id: '1',
          label: 'Dąbrówki 10',
          detail: `Mińsk Mazowiecki (${query})`,
          center: [21.5753, 52.1771] as [number, number],
          bbox: [21.574, 52.176, 21.5765, 52.1783] as [number, number, number, number],
        },
      ].slice(0, limit),
    ),
};

const app = makeApp({ placeSource });

describe('/places', () => {
  it('oddaje miejsca z punktem i zasiegiem, z cache brzegowym', async () => {
    const res = await app.request(`/places/search?${new URLSearchParams({ q: 'Dąbrówki 10' }).toString()}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: '1',
          label: 'Dąbrówki 10',
          detail: 'Mińsk Mazowiecki (Dąbrówki 10)',
          center: [21.5753, 52.1771],
          bbox: [21.574, 52.176, 21.5765, 52.1783],
        },
      ],
    });
    expect(res.headers.get('cache-tag')).toContain('places');
  });

  it('za krotkie zapytanie = 400', async () => {
    expect((await app.request('/places/search?q=ab')).status).toBe(400);
  });
});
