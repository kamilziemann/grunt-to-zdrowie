import { describe, expect, it } from 'vitest';

import {
  createEgibWfsOutlineSource,
  createEgibWfsParcelSource,
  createEgibWfsRegistry,
  parseOutlines,
  TRUNCATED_AT,
  type FetchLike,
} from './egib-wfs';
import recordedZ14 from './egib-wfs-z14.recorded.json?raw';

/** Prawdziwa odpowiedz WFS dla kafla z14 9066/5250 (Rychnowo Zulawskie, 2026-11-22), z polami, ktore czytamy. */
const RECORDED_Z14 = JSON.parse(recordedZ14) as { features: { properties: Record<string, unknown> }[] };

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

  it('nagrany kafel z14 na terenie rolnym (Zulawy, 93 dzialki) nie jest obciety', async () => {
    const fetchImpl = fakeFetch(RECORDED_Z14);
    const result = await createEgibWfsOutlineSource(fetchImpl).inBounds([19.204, 54.125, 19.226, 54.138]);

    expect(result.items).toHaveLength(93);
    expect(result.items[0]).toMatchObject({ id: '220907_5.0007.160', number: expect.any(String) });
    expect(result.truncated).toBe(false);
    // usluga sama obcina odpowiedz na ok. 940 dzialkach - prosimy o niewiele wiecej
    expect(new URL(fetchImpl.urls[0] ?? '').searchParams.get('COUNT')).toBe('1000');
  });

  it('kafel z liczba dzialek przy limicie uslugi (936 jak w Minsku Mazowieckim) jest obciety', async () => {
    // nagrane obiekty powielone do liczby z pomiaru kafla miejskiego (cala odpowiedz ma ok. 700 kB)
    const features = Array.from({ length: 936 }, (_, index) => {
      const feature = RECORDED_Z14.features[index % RECORDED_Z14.features.length];

      return { ...feature, properties: { ...feature?.properties, ID_DZIALKI: `id-${index}` } };
    });
    const result = await createEgibWfsOutlineSource(fakeFetch({ features })).inBounds([21, 52, 21.02, 52.01]);

    expect(result.items).toHaveLength(936);
    expect(result.truncated).toBe(true);
    expect(TRUNCATED_AT).toBeLessThan(936);
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

  it('czyta klasouzytki i powierzchnie ewidencyjna (pola ze slownika uslugi)', async () => {
    const feature = {
      ...FEATURE,
      properties: { ...FEATURE.properties, POLE_EWIDENYJNE: '19.3485', KLASOUZYTKI_EGIB: 'RIVb,RV, W/ŁV' },
    };
    const parcel = await createEgibWfsParcelSource(fakeFetch({ features: [feature] })).byId(
      '141201_1.0001.6550/3',
    );

    expect(parcel).toMatchObject({ landUse: ['RIVb', 'RV', 'W/ŁV'], registryAreaHa: 19.3485 });
  });

  it('nie umie szukac po nazwie obrebu', async () => {
    await expect(createEgibWfsParcelSource(fakeFetch({})).byName('Dąbrowa 12', 10)).rejects.toMatchObject({
      code: 'upstream_failed',
    });
  });
});

describe('createEgibWfsRegistry', () => {
  it('oddaje klasouzytki dzialki; bez klasouzytkow albo bez dzialki - null', async () => {
    const feature = { ...FEATURE, properties: { ...FEATURE.properties, KLASOUZYTKI_EGIB: 'dr' } };
    const registry = createEgibWfsRegistry(createEgibWfsParcelSource(fakeFetch({ features: [feature] })));
    const bare = createEgibWfsRegistry(createEgibWfsParcelSource(fakeFetch({ features: [FEATURE] })));
    const empty = createEgibWfsRegistry(createEgibWfsParcelSource(fakeFetch({ features: [] })));

    expect(await registry.byId('141201_1.0001.6550/3')).toEqual({ landUse: ['dr'] });
    expect(await bare.byId('141201_1.0001.6550/3')).toBeNull();
    expect(await empty.byId('141201_1.0001.6550/3')).toBeNull();
  });
});
