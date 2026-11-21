import { describe, expect, it } from 'vitest';

import { createNominatimPlaceSource, parsePlaces, type FetchLike } from './nominatim';

const ADDRESS = {
  place_id: 123,
  lat: '52.1771155',
  lon: '21.5752731',
  name: 'Szkoła Podstawowa nr 2',
  display_name: 'Szkoła Podstawowa nr 2, 10, Dąbrówki, Mińsk Mazowiecki, powiat miński, Polska',
  boundingbox: ['52.1768', '52.1774', '21.5748', '21.5757'],
  address: {
    house_number: '10',
    road: 'Dąbrówki',
    town: 'Mińsk Mazowiecki',
    county: 'powiat miński',
    state: 'województwo mazowieckie',
  },
};

const VILLAGE = {
  place_id: 456,
  lat: '51.4',
  lon: '17.3',
  name: 'Dąbrowa',
  boundingbox: ['51.38', '51.42', '17.27', '17.33'],
  address: {
    village: 'Dąbrowa',
    municipality: 'gmina Krośnice',
    county: 'powiat milicki',
    state: 'województwo dolnośląskie',
  },
};

describe('parsePlaces', () => {
  it('adres: ulica z numerem w pierwszej linii, miejscowosc i powiat w drugiej', () => {
    const [place] = parsePlaces([ADDRESS]);

    expect(place).toMatchObject({
      id: '123',
      label: 'Dąbrówki 10',
      detail: 'Mińsk Mazowiecki, powiat miński, województwo mazowieckie',
      center: [21.5752731, 52.1771155],
    });
  });

  it('miejscowosc: nazwa w pierwszej linii i wlasny zasieg', () => {
    const [place] = parsePlaces([VILLAGE]);

    expect(place?.label).toBe('Dąbrowa');
    expect(place?.detail).toBe('gmina Krośnice, powiat milicki, województwo dolnośląskie');
    expect(place?.bbox).toEqual([17.27, 51.38, 17.33, 51.42]);
  });

  it('punkt adresowy dostaje okno, w ktorym widac sasiednie dzialki', () => {
    const [place] = parsePlaces([{ ...ADDRESS, boundingbox: undefined }]);
    const [west = 0, south = 0, east = 0, north = 0] = place?.bbox ?? [];

    expect(east - west).toBeCloseTo(0.0024, 6);
    expect(north - south).toBeCloseTo(0.0024, 6);
  });

  it('pomija wpisy bez wspolrzednych, a odpowiedz niebedaca lista to blad', () => {
    expect(parsePlaces([{ place_id: 1, lat: 'x', lon: '21' }])).toEqual([]);
    expect(() => parsePlaces({ error: 'x' })).toThrow('not a list');
  });
});

describe('createNominatimPlaceSource', () => {
  it('szuka tylko w Polsce, po polsku i przedstawia aplikacje', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, headers: init.headers });

      return Promise.resolve(new Response(JSON.stringify([ADDRESS])));
    };
    const places = await createNominatimPlaceSource(fetchImpl).search('Mińsk Mazowiecki Dąbrówki 10', 6);
    const params = new URL(calls[0]?.url ?? '').searchParams;

    expect(places).toHaveLength(1);
    expect(params.get('countrycodes')).toBe('pl');
    expect(params.get('limit')).toBe('6');
    expect(calls[0]?.headers['user-agent']).toContain('grunt-to-zdrowie');
  });

  it('blad uslugi = upstream_failed', async () => {
    const failing: FetchLike = () => Promise.resolve(new Response('', { status: 429 }));

    await expect(createNominatimPlaceSource(failing).search('x', 6)).rejects.toMatchObject({
      code: 'upstream_failed',
    });
  });
});
