import type { ContextFeature, ContextTile } from '@app/contracts';
import { createRpcClient } from '@app/rpc';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppType } from '../rpc/app-type';

import {
  areaLabels,
  contextCollections,
  ContextUnavailableError,
  fetchContextTile,
  latestContextImport,
  onTileEdge,
  ringOutline,
} from './context-map';

// klient API jak w przegladarce (fetch do /api), bez kontekstu TanStack Start; `fetch` podmienia test
vi.mock('../api', () => ({
  getApi: () =>
    createRpcClient<AppType>('http://localhost/api', {
      fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    }),
}));

// krawedz kafli z14 x = 9174|9175 (dlugosc 21.5771484375) i y = 5398|5399 (szerokosc ok. 52.1739)
const EDGE_LNG = (9175 / 2 ** 14) * 360 - 180;
const EDGE_LAT = (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * 5399) / 2 ** 14)) * 180) / Math.PI;

const tile = (features: ContextFeature[], extra: Partial<ContextTile> = {}): ContextTile => ({
  layer: 'protected',
  features,
  truncated: false,
  importedAt: null,
  ...extra,
});

// ten sam park narodowy w dwoch kafilach: kawalki stykaja sie na krawedzi kafla (dlugosc EDGE_LNG)
const WEST_PIECE: ContextFeature = {
  kind: 'national_park',
  name: 'Biebrzański Park Narodowy',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [EDGE_LNG - 0.01, 52.16],
        [EDGE_LNG, 52.16],
        [EDGE_LNG, 52.17],
        [EDGE_LNG - 0.01, 52.17],
        [EDGE_LNG - 0.01, 52.16],
      ],
    ],
  },
};

const EAST_PIECE: ContextFeature = {
  ...WEST_PIECE,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [EDGE_LNG, 52.16],
        [EDGE_LNG + 0.02, 52.16],
        [EDGE_LNG + 0.02, 52.17],
        [EDGE_LNG, 52.17],
        [EDGE_LNG, 52.16],
      ],
    ],
  },
};

const WEIR: ContextFeature = {
  kind: 'weir',
  name: null,
  geometry: {
    type: 'LineString',
    coordinates: [
      [21.5, 52.1],
      [21.5001, 52.1],
      [21.5002, 52.1],
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('context-map', () => {
  it('odcinek na krawedzi kafla (pionowej i poziomej) rozpoznany, odcinek obok - nie', () => {
    expect(onTileEdge([EDGE_LNG, 52.16], [EDGE_LNG + 0.000_005, 52.17])).toBe(true);
    expect(onTileEdge([21.56, EDGE_LAT], [21.57, EDGE_LAT])).toBe(true);
    expect(onTileEdge([EDGE_LNG + 0.001, 52.16], [EDGE_LNG + 0.001, 52.17])).toBe(false);
    expect(onTileEdge([EDGE_LNG, 52.16], [EDGE_LNG - 0.01, 52.16])).toBe(false);
  });

  it('obrys bez odcinka na krawedzi kafla: jeden ciag linii zamiast zamknietego pierscienia', () => {
    const ring = WEST_PIECE.geometry.type === 'Polygon' ? (WEST_PIECE.geometry.coordinates[0] ?? []) : [];
    const parts = ringOutline(ring);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveLength(4);
    expect(parts[0]?.[0]).toEqual([EDGE_LNG, 52.17]);
  });

  it('znak budowli w srodku linii z podpisem rodzaju; obiekt z dwoch kafli raz', () => {
    const { features, outlines, marks } = contextCollections(
      [tile([WEIR, WEST_PIECE]), tile([WEST_PIECE, EAST_PIECE])],
      { weir: 'jaz' },
    );

    expect(features.features).toHaveLength(3);
    expect(outlines.features).toHaveLength(2);
    expect(marks.features).toEqual([
      expect.objectContaining({
        properties: { kind: 'weir', name: '', label: 'jaz' },
        geometry: { type: 'Point', coordinates: [21.5001, 52.1] },
      }),
    ]);
  });

  it('jeden podpis na obszar w widoku, w kawalku zajmujacym najwiecej widoku; rodzaj tylko gdy nazwa go nie mowi', () => {
    const view: [number, number, number, number] = [EDGE_LNG - 0.02, 52.15, EDGE_LNG + 0.03, 52.18];
    const labels = areaLabels([tile([WEST_PIECE]), tile([EAST_PIECE])], view, {
      national_park: 'park narodowy',
      natura2000: 'Natura 2000',
    });

    expect(labels.features).toHaveLength(1);
    expect(labels.features[0]?.properties?.label).toBe('Biebrzański Park Narodowy');
    const [lng = 0, lat = 0] =
      labels.features[0]?.geometry.type === 'Point' ? labels.features[0].geometry.coordinates : [];

    expect(lng).toBeCloseTo(EDGE_LNG + 0.01, 9);
    expect(lat).toBeCloseTo(52.165, 9);

    const natura = areaLabels([tile([{ ...EAST_PIECE, kind: 'natura2000', name: 'Dolina Biebrzy' }])], view, {
      natura2000: 'Natura 2000',
    });

    expect(natura.features[0]?.properties?.label).toBe('Dolina Biebrzy\nNatura 2000');
    expect(areaLabels([tile([EAST_PIECE])], [0, 0, 1, 1]).features).toHaveLength(0);
  });

  it('data danych: najnowszy import z kafli', () => {
    expect(
      latestContextImport([
        tile([], { importedAt: '2026-11-20T10:00:00Z' }),
        tile([], { importedAt: null }),
        tile([], { importedAt: '2026-11-21T08:00:00Z' }),
      ]),
    ).toBe('2026-11-21T08:00:00Z');
  });

  it('502/503 = warstwa niedostepna, odpowiedz sprawdzana kontraktem', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(fetchContextTile('cover', 1, 2)).rejects.toBeInstanceOf(ContextUnavailableError);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 502 }));
    await expect(fetchContextTile('cover', 1, 2)).rejects.toBeInstanceOf(ContextUnavailableError);
    fetchMock.mockResolvedValueOnce(Response.json({ layer: 'cover', features: 'zle' }));
    await expect(fetchContextTile('cover', 1, 2)).rejects.toThrow(/expected array/i);
    fetchMock.mockResolvedValueOnce(Response.json(tile([WEIR], { layer: 'waterworks' })));
    await expect(fetchContextTile('waterworks', 1, 2)).resolves.toMatchObject({ features: [WEIR] });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost/api/context/tile?layer=waterworks&x=1&y=2',
      expect.anything(),
    );
  });
});
