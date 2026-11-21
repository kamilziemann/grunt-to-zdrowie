// Podstawiona warstwa "Rowy i cieki" i podklad mapy dla e2e: trasa /api/hydro/tile powstaje na drugiej galezi,
// a podklad (OpenFreeMap) i zdjecie (GUGiK) to uslugi zewnetrzne. Styl podkladu = samo tlo, wiec mapa laduje sie
// bez sieci; kafle hydrografii z fixture (prawdziwe dane BDOT10k wokol dzialki testowej).
import type { Page } from '@playwright/test';

import { HYDRO_TILES } from '../../src/features/parcels/fixtures/hydro-tiles';

const EMPTY_TILE = { features: [], truncated: false, importedAt: '2026-11-21T20:40:36.816Z' };

/** Podklad mapy bez sieci: styl z samym tlem; czcionki i zdjecie lotnicze odrzucone. */
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
  await page.route('https://mapy.geoportal.gov.pl/**', (route) => route.abort());
}

/**
 * Kafle hydrografii: z fixture (inne kafle puste) albo blad `status` (404/503 = warstwa chwilowo niedostepna).
 * Zwraca liste adresow pobranych kafli ("x/y").
 */
export async function mockHydroApi(
  page: Page,
  { status = 200 }: { status?: number } = {},
): Promise<string[]> {
  const requested: string[] = [];

  await page.route('**/api/hydro/tile**', (route) => {
    const url = new URL(route.request().url());
    const key = `${url.searchParams.get('x') ?? ''}/${url.searchParams.get('y') ?? ''}`;

    requested.push(key);

    if (status !== 200) return route.fulfill({ status, body: '' });

    return route.fulfill({ json: HYDRO_TILES[key] ?? EMPTY_TILE });
  });

  return requested;
}
