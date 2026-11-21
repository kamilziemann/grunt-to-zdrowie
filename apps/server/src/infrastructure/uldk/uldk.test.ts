import { describe, expect, it } from 'vitest';

import { createUldkParcelSource, parseParcelMatches, parseSingleParcel, type FetchLike } from './uldk';

const PARCEL_ROW =
  '141201_1.0001.6509|mazowieckie|powiat miński|Mińsk Mazowiecki (miasto)|Mińsk Mazowiecki|6509|SRID=4326;POLYGON((21.5898 52.1716,21.5904 52.1722,21.5897 52.1722,21.5893 52.1718,21.5898 52.1716))';

const MATCHES = [
  '61',
  '021302_2.0005.12|dolnośląskie|powiat milicki|Krośnice|Dąbrowa|12',
  '021406_2.0006.12|dolnośląskie|powiat oleśnicki|Oleśnica|Dąbrowa|12',
  '040901_2.0002.12|kujawsko-pomorskie|powiat mogileński|Dąbrowa|Dąbrowa|12',
].join('\n');

function fakeFetch(body: string, status = 200): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const impl: FetchLike = (url) => {
    urls.push(url);

    return Promise.resolve(new Response(body, { status }));
  };

  return Object.assign(impl, { urls });
}

describe('parseSingleParcel', () => {
  it('czyta dzialke po statusie 0', () => {
    expect(parseSingleParcel(`0\n${PARCEL_ROW}\n`)).toMatchObject({
      id: '141201_1.0001.6509',
      number: '6509',
      region: 'Mińsk Mazowiecki',
      commune: 'Mińsk Mazowiecki (miasto)',
      county: 'powiat miński',
      voivodeship: 'mazowieckie',
      geometry: { type: 'Polygon' },
    });
  });

  it('status -1 znaczy brak dzialki', () => {
    expect(parseSingleParcel('-1 brak wyników')).toBeNull();
  });

  it('pusta albo nieczytelna odpowiedz to blad', () => {
    expect(() => parseSingleParcel('')).toThrow('empty ULDK response');
    expect(() => parseSingleParcel('0\nabc|def')).toThrow('unreadable ULDK parcel row');
    expect(() => parseSingleParcel('<html>blad</html>')).toThrow('unexpected ULDK status');
  });
});

describe('parseParcelMatches', () => {
  it('pierwsza linia to liczba trafien, nie status', () => {
    const result = parseParcelMatches(MATCHES, 2);

    expect(result.total).toBe(61);
    expect(result.items.map((item) => item.id)).toEqual(['021302_2.0005.12', '021406_2.0006.12']);
    expect(result.items[0]).toMatchObject({
      commune: 'Krośnice',
      county: 'powiat milicki',
      region: 'Dąbrowa',
    });
  });

  it('brak wynikow to pusta lista', () => {
    expect(parseParcelMatches('-1 brak wyników', 10)).toEqual({ total: 0, items: [] });
  });
});

describe('createUldkParcelSource', () => {
  it('zawsze prosi o WGS84, takze w punkcie', async () => {
    const fetchImpl = fakeFetch(`0\n${PARCEL_ROW}`);
    const source = createUldkParcelSource(fetchImpl);

    await source.byId('141201_1.0001.6509');
    await source.byPoint(21.59, 52.172);

    const [byId, byPoint] = fetchImpl.urls.map((url) => new URL(url).searchParams);

    expect(byId?.get('request')).toBe('GetParcelById');
    expect(byId?.get('srid')).toBe('4326');
    expect(byPoint?.get('xy')).toBe('21.59,52.172,4326');
    expect(byPoint?.get('srid')).toBe('4326');
  });

  it('wyszukiwanie po nazwie nie pobiera geometrii', async () => {
    const fetchImpl = fakeFetch(MATCHES);
    const result = await createUldkParcelSource(fetchImpl).byName('Dąbrowa 12', 100);
    const params = new URL(fetchImpl.urls[0] ?? '').searchParams;

    expect(result.items).toHaveLength(3);
    expect(params.get('request')).toBe('GetParcelByIdOrNr');
    expect(params.get('id')).toBe('Dąbrowa 12');
    expect(params.get('result')).not.toContain('geom');
  });

  it('ponawia raz po bledzie i oddaje dzialke z drugiej proby', async () => {
    let calls = 0;
    const flaky: FetchLike = () => {
      calls += 1;

      return Promise.resolve(
        calls === 1 ? new Response('', { status: 502 }) : new Response(`0\n${PARCEL_ROW}`),
      );
    };

    await expect(createUldkParcelSource(flaky).byId('141201_1.0001.6509')).resolves.toMatchObject({
      number: '6509',
    });
    expect(calls).toBe(2);
  });

  it('przekierowanie (limit zapytan) konczy od razu, bez ponowienia', async () => {
    const fetchImpl = fakeFetch('', 302);

    await expect(createUldkParcelSource(fetchImpl).byId('x')).rejects.toMatchObject({
      code: 'upstream_failed',
    });
    expect(fetchImpl.urls).toHaveLength(1);
  });

  it('blad HTTP i nieczytelna odpowiedz daja upstream_failed', async () => {
    await expect(createUldkParcelSource(fakeFetch('', 503)).byId('x')).rejects.toMatchObject({
      code: 'upstream_failed',
    });
    await expect(createUldkParcelSource(fakeFetch('')).byName('x', 10)).rejects.toMatchObject({
      code: 'upstream_failed',
    });
  });
});
