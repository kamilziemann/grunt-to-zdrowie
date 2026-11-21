import { describe, expect, it } from 'vitest';

import {
  createEgibWfsOutlineSource,
  createEgibWfsParcelSource,
  parseOutlines,
  type FetchLike,
} from './egib-wfs';

const FEATURE = {
  type: 'Feature',
  properties: {
    ID_DZIALKI: '141201_1.0001.6550/3',
    NUMER_DZIALKI: '6550/3',
    NAZWA_OBREBU: 'MIŃSK MAZOWIECKI',
    NAZWA_GMINY: 'Mińsk Mazowiecki',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.593677825756682, 52.174130414625687],
        [21.593609810214215, 52.174050674630415],
        [21.595053598718867, 52.17369197413683],
        [21.593677825756682, 52.174130414625687],
      ],
    ],
  },
};

function fakeFetch(body: unknown, status = 200): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const impl: FetchLike = (url) => {
    urls.push(url);

    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };

  return Object.assign(impl, { urls });
}

describe('parseOutlines', () => {
  it('czyta identyfikator, numer i geometrie zaokraglona do 6 miejsc', () => {
    expect(parseOutlines({ features: [FEATURE] })).toEqual([
      {
        id: '141201_1.0001.6550/3',
        number: '6550/3',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [21.593678, 52.17413],
              [21.59361, 52.174051],
              [21.595054, 52.173692],
              [21.593678, 52.17413],
            ],
          ],
        },
      },
    ]);
  });

  it('pomija obiekty bez identyfikatora i z inna geometria', () => {
    const broken = [
      { properties: {}, geometry: FEATURE.geometry },
      { properties: FEATURE.properties, geometry: { type: 'Point', coordinates: [21, 52] } },
      { properties: FEATURE.properties, geometry: null },
    ];

    expect(parseOutlines({ features: broken })).toEqual([]);
  });

  it('odpowiedz bez listy obiektow to blad', () => {
    expect(() => parseOutlines({ error: 'x' })).toThrow('no features array');
  });
});

describe('createEgibWfsOutlineSource', () => {
  it('pyta o GeoJSON w WGS84 z prostokatem w kolejnosci szerokosc, dlugosc', async () => {
    const fetchImpl = fakeFetch({ features: [FEATURE] });
    const result = await createEgibWfsOutlineSource(fetchImpl).inBounds([21.586, 52.169, 21.594, 52.174]);
    const params = new URL(fetchImpl.urls[0] ?? '').searchParams;

    expect(result.items).toHaveLength(1);
    expect(result.truncated).toBe(false);
    expect(params.get('TYPENAMES')).toBe('ms:dzialki');
    expect(params.get('OUTPUTFORMAT')).toBe('application/json');
    expect(params.get('BBOX')).toBe('52.169,21.586,52.174,21.594,urn:ogc:def:crs:EPSG::4326');
  });

  it('blad HTTP i nieczytelna odpowiedz daja upstream_failed', async () => {
    const bounds = [21, 52, 21.01, 52.01] as [number, number, number, number];

    await expect(createEgibWfsOutlineSource(fakeFetch({}, 503)).inBounds(bounds)).rejects.toMatchObject({
      code: 'upstream_failed',
    });
    await expect(createEgibWfsOutlineSource(fakeFetch({})).inBounds(bounds)).rejects.toMatchObject({
      code: 'upstream_failed',
    });
  });
});

describe('createEgibWfsParcelSource', () => {
  it('po identyfikatorze pyta filtrem i oddaje opis z WFS (wojewodztwo z TERYT, bez powiatu)', async () => {
    const fetchImpl = fakeFetch({ features: [FEATURE] });
    const parcel = await createEgibWfsParcelSource(fetchImpl).byId('141201_1.0001.6550/3');
    const params = new URL(fetchImpl.urls[0] ?? '').searchParams;

    expect(params.get('FILTER')).toContain('<fes:Literal>141201_1.0001.6550/3</fes:Literal>');
    expect(parcel).toMatchObject({
      id: '141201_1.0001.6550/3',
      number: '6550/3',
      region: 'Mińsk Mazowiecki',
      commune: 'Mińsk Mazowiecki',
      county: '',
      voivodeship: 'mazowieckie',
      origin: 'egib-wfs',
    });
  });

  it('pod punktem wybiera dzialke, w ktorej lezy punkt; pusta odpowiedz = brak dzialki', async () => {
    const source = createEgibWfsParcelSource(fakeFetch({ features: [FEATURE] }));
    const empty = createEgibWfsParcelSource(fakeFetch({ features: [] }));

    expect((await source.byPoint(21.5941, 52.17396))?.id).toBe('141201_1.0001.6550/3');
    expect(await empty.byPoint(21, 52)).toBeNull();
    expect(await empty.byId('141201_1.0001.1')).toBeNull();
  });

  it('nie umie szukac po nazwie obrebu', async () => {
    await expect(createEgibWfsParcelSource(fakeFetch({})).byName('Dąbrowa 12', 10)).rejects.toMatchObject({
      code: 'upstream_failed',
    });
  });
});
