// Mapa dzialek w e2e bez uslug zewnetrznych i bez bazy: podklad (OpenFreeMap) i zdjecie (GUGiK) podstawione, kafle
// granic, rowow i otoczenia puste (albo z `hydro`/`context`). Wspolne dla specow ekranu dzialek; test czeka na
// `data-map-state="ready"` (`waitForMap`), zanim kliknie w mape albo sprawdzi axe.
import type { HydroTile } from '@app/contracts';
import { expect, type Page } from '@playwright/test';

import { mockContextApi } from './context-api';
import { mockBasemap, mockHydroApi } from './hydro-api';

export async function mockMapServices(
  page: Page,
  { hydro = {} }: { hydro?: Record<string, HydroTile> } = {},
): Promise<void> {
  await mockBasemap(page);
  await mockHydroApi(page, { tiles: hydro });
  await mockContextApi(page, { tiles: {} });
  await page.route('**/api/parcels/boundaries**', (route) =>
    route.fulfill({ json: { items: [], truncated: false } }),
  );
}

/** Mapa po zaladowaniu stylu i warstw aplikacji. */
export async function waitForMap(page: Page): Promise<void> {
  await expect(page.getByTestId('parcel-map')).toHaveAttribute('data-map-state', 'ready');
}

/** Otwiera panel "Warstwy" przy mapie (jesli jest zamkniety). */
export async function openLayers(page: Page): Promise<void> {
  const button = page.getByTestId('layers-button');

  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(page.getByTestId('layers-panel')).toBeVisible();
}

/** Ustawia pole wyboru warstwy w panelu "Warstwy" (otwiera panel, jesli trzeba). */
export async function setLayer(page: Page, name: string, on: boolean): Promise<void> {
  await openLayers(page);
  await page.getByTestId('layers-panel').getByRole('checkbox', { name }).setChecked(on);
}
