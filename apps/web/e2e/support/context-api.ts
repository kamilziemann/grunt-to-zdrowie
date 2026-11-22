// Podstawione warstwy "otoczenie pola" dla e2e: trasa /api/context/tile czyta baze PostGIS (w e2e jej nie ma).
// Kafel przy dzialce testowej (9174/5399) ma po kilka obiektow kazdej warstwy; inne kafle sa puste.
import type { ContextLayer, ContextTile } from '@app/contracts';
import type { Page } from '@playwright/test';

export const CONTEXT_IMPORTED_AT = '2026-11-21T22:52:46.580Z';

const FOREST_RING: [number, number][] = [
  [21.586, 52.173],
  [21.588, 52.173],
  [21.588, 52.1745],
  [21.586, 52.1745],
  [21.586, 52.173],
];

const PARK_RING: [number, number][] = [
  [21.58, 52.168],
  [21.6, 52.168],
  [21.6, 52.18],
  [21.58, 52.18],
  [21.58, 52.168],
];

export const CONTEXT_TILES: Record<ContextLayer, ContextTile> = {
  cover: {
    layer: 'cover',
    features: [
      { kind: 'forest', name: null, geometry: { type: 'Polygon', coordinates: [FOREST_RING] } },
      {
        kind: 'tree_row',
        name: null,
        geometry: {
          type: 'LineString',
          coordinates: [
            [21.589, 52.1715],
            [21.592, 52.1715],
          ],
        },
      },
    ],
    truncated: false,
    importedAt: CONTEXT_IMPORTED_AT,
  },
  waterworks: {
    layer: 'waterworks',
    features: [
      {
        kind: 'weir',
        name: null,
        geometry: {
          type: 'LineString',
          coordinates: [
            [21.5915, 52.1735],
            [21.5917, 52.1735],
          ],
        },
      },
      { kind: 'spring', name: 'Źródło Leśne', geometry: { type: 'Point', coordinates: [21.5895, 52.1738] } },
    ],
    truncated: false,
    importedAt: CONTEXT_IMPORTED_AT,
  },
  protected: {
    layer: 'protected',
    features: [
      { kind: 'natura2000', name: 'Dolina Testowa', geometry: { type: 'Polygon', coordinates: [PARK_RING] } },
    ],
    truncated: false,
    importedAt: CONTEXT_IMPORTED_AT,
  },
};

const NEAR_PARCEL = '9174/5399';

/**
 * Kafle otoczenia: z `tiles` przy dzialce testowej (inne puste) albo blad `status` (502/503 = baza nie odpowiada).
 * Zwraca liste pobranych kafli ("warstwa x/y").
 */
export async function mockContextApi(
  page: Page,
  {
    status = 200,
    tiles = CONTEXT_TILES,
  }: { status?: number; tiles?: Partial<Record<ContextLayer, ContextTile>> } = {},
): Promise<string[]> {
  const requested: string[] = [];

  await page.route('**/api/context/tile**', (route) => {
    const url = new URL(route.request().url());
    const layer = (url.searchParams.get('layer') ?? 'cover') as ContextLayer;
    const key = `${url.searchParams.get('x') ?? ''}/${url.searchParams.get('y') ?? ''}`;

    requested.push(`${layer} ${key}`);

    if (status !== 200) return route.fulfill({ status, body: '' });

    const tile = tiles[layer];

    return route.fulfill({
      json:
        key === NEAR_PARCEL && tile
          ? tile
          : { layer, features: [], truncated: false, importedAt: CONTEXT_IMPORTED_AT },
    });
  });

  return requested;
}
