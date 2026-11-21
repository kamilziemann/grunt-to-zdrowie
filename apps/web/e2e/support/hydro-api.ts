// Podstawiona warstwa "Rowy i cieki" i podklad mapy dla e2e: trasa /api/hydro/tile czyta baze PostGIS (w e2e jej
// nie ma), a podklad (OpenFreeMap) i zdjecie (GUGiK) to uslugi zewnetrzne. Styl podkladu = samo tlo, wiec mapa
// laduje sie bez sieci; kafle hydrografii z fixture (prawdziwe dane BDOT10k wokol dzialki testowej).
import type { HydroTile } from '@app/contracts';
import type { Page } from '@playwright/test';

import { HYDRO_TILES } from '../../src/features/parcels/fixtures/hydro-tiles';

// 1 x 1 px PNG: kafel zdjecia lotniczego bez sieci (odrzucone zapytanie zasmieca log bledami MapLibre)
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

const EMPTY_TILE = { features: [], truncated: false, importedAt: '2026-11-21T20:40:36.816Z' };

/** Podklad mapy bez sieci: styl z samym tlem, puste kafle zdjecia lotniczego; czcionki odrzucone. */
export async function mockBasemap(page: Page) {
  await page.route('https://tiles.openfreemap.org/styles/**', (route) =>
    route.fulfill({
      json: {
        version: 8,
        glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } }],
      },
    }),
  );
  await page.route('https://tiles.openfreemap.org/fonts/**', (route) => route.abort());
  await page.route('https://mapy.geoportal.gov.pl/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: BLANK_PNG,
    }),
  );
}

/**
 * Kafle hydrografii: z fixture albo `tiles` (inne kafle puste) albo blad `status` (404/503 = warstwa chwilowo niedostepna).
 * Zwraca liste adresow pobranych kafli ("x/y").
 */
export async function mockHydroApi(
  page: Page,
  { status = 200, tiles = HYDRO_TILES }: { status?: number; tiles?: Record<string, HydroTile> } = {},
): Promise<string[]> {
  const requested: string[] = [];

  await page.route('**/api/hydro/tile**', (route) => {
    const url = new URL(route.request().url());
    const key = `${url.searchParams.get('x') ?? ''}/${url.searchParams.get('y') ?? ''}`;

    requested.push(key);

    if (status !== 200) return route.fulfill({ status, body: '' });

    return route.fulfill({ json: tiles[key] ?? EMPTY_TILE });
  });

  return requested;
}

/**
 * Kafle z fixture plus rów przecinający środek działki 6509 (z zachodu na wschód, ok. 75 m w polu) - prawdziwy rów
 * tej działki biegnie jej skrajem, a szkic ma pokazać też wariant "Rów przez pole".
 */
export const DITCH_THROUGH_TILES: Record<string, HydroTile> = {
  ...HYDRO_TILES,
  '9174/5399': {
    ...(HYDRO_TILES['9174/5399'] ?? EMPTY_TILE),
    features: [
      ...(HYDRO_TILES['9174/5399']?.features ?? []),
      {
        kind: 'ditch',
        name: null,
        geometry: {
          type: 'LineString',
          coordinates: [
            [21.5888, 52.17195],
            [21.5908, 52.17195],
          ],
        },
      },
    ],
  },
};
