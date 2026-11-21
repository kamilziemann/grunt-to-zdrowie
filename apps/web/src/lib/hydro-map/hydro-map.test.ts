import type { HydroFeature, ParcelGeometry } from '@app/contracts';
import { createRpcClient } from '@app/rpc';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppType } from '../rpc/app-type';

import {
  fetchHydroTile,
  hydroCollections,
  hydroTiles,
  hydroWithin,
  HydroUnavailableError,
  latestImport,
  nearestHydro,
} from './hydro-map';

// klient API jak w przegladarce (fetch do /api), bez kontekstu TanStack Start; `fetch` podmienia test
vi.mock('../api', () => ({
  getApi: () =>
    createRpcClient<AppType>('http://localhost/api', {
      fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    }),
}));

// pole ok. 70 x 70 m kolo Minska Mazowieckiego
const FIELD: ParcelGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [21.59, 52.172],
      [21.591, 52.172],
      [21.591, 52.1726],
      [21.59, 52.1726],
      [21.59, 52.172],
    ],
  ],
};

const DITCH_THROUGH: HydroFeature = {
  kind: 'ditch',
  name: null,
  geometry: {
    type: 'LineString',
    coordinates: [
      [21.5895, 52.1723],
      [21.5915, 52.1723],
    ],
  },
};

// ok. 136 m na wschod od pola (0,002 stopnia dlugosci na tej szerokosci)
const RIVER_EAST: HydroFeature = {
  kind: 'river',
  name: 'Srebrna',
  geometry: {
    type: 'LineString',
    coordinates: [
      [21.593, 52.17],
      [21.593, 52.175],
    ],
  },
};

const STREAM_NEAR: HydroFeature = {
  kind: 'stream',
  name: null,
  geometry: {
    type: 'LineString',
    coordinates: [
      [21.5915, 52.17],
      [21.5915, 52.175],
    ],
  },
};

const FAR_POND: HydroFeature = {
  kind: 'standing_water',
  name: 'Staw',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.61, 52.18],
        [21.611, 52.18],
        [21.611, 52.181],
        [21.61, 52.18],
      ],
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hydro-map', () => {
  it('kafle z przyblizenia 14 pokrywajace widok', () => {
    const tiles = hydroTiles(21.58, 52.16, 21.6, 52.18);

    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]).toEqual({ x: 9174, y: 5398 });
    expect(new Set(tiles.map((tile) => `${tile.x}/${tile.y}`)).size).toBe(tiles.length);
  });

  it('linie i poligony osobno, obiekt z dwoch kafli raz', () => {
    const { lines, areas } = hydroCollections([
      [DITCH_THROUGH, RIVER_EAST],
      [RIVER_EAST, FAR_POND],
    ]);

    expect(lines.features.map((feature) => feature.properties?.kind)).toEqual(['ditch', 'river']);
    expect(areas.features.map((feature) => feature.properties?.name)).toEqual(['Staw']);
  });

  it('najblizszy row (przez pole = 0 m), najblizszy ciek i najblizszy nazwany ciek', () => {
    const nearest = nearestHydro(FIELD, [DITCH_THROUGH, RIVER_EAST, STREAM_NEAR, FAR_POND], 500);

    expect(nearest.ditch?.distanceM).toBe(0);
    expect(nearest.watercourse?.feature).toBe(STREAM_NEAR);
    expect(nearest.watercourse?.distanceM).toBeCloseTo(34, 0);
    expect(nearest.named?.feature.name).toBe('Srebrna');
    expect(nearest.named?.distanceM).toBeCloseTo(137, -1);
    expect(hydroWithin(FIELD, [DITCH_THROUGH, RIVER_EAST, FAR_POND], 500)).toEqual([
      DITCH_THROUGH,
      RIVER_EAST,
    ]);
  });

  it('data danych: najnowszy import z kafli', () => {
    expect(
      latestImport([
        { features: [], truncated: false, importedAt: '2026-11-20T10:00:00Z' },
        { features: [], truncated: false, importedAt: null },
        { features: [], truncated: false, importedAt: '2026-11-21T08:00:00Z' },
      ]),
    ).toBe('2026-11-21T08:00:00Z');
  });

  it('404/502/503 = warstwa niedostepna, odpowiedz sprawdzana kontraktem', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(fetchHydroTile(1, 2)).rejects.toBeInstanceOf(HydroUnavailableError);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 502 }));
    await expect(fetchHydroTile(1, 2)).rejects.toBeInstanceOf(HydroUnavailableError);
    fetchMock.mockResolvedValueOnce(Response.json({ features: 'zle' }));
    await expect(fetchHydroTile(1, 2)).rejects.toThrow(/expected array/i);
    fetchMock.mockResolvedValueOnce(
      Response.json({ features: [DITCH_THROUGH], truncated: false, importedAt: '2026-11-21T08:00:00Z' }),
    );
    await expect(fetchHydroTile(1, 2)).resolves.toMatchObject({ features: [DITCH_THROUGH] });
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost/api/hydro/tile?x=1&y=2', expect.anything());
  });
});
