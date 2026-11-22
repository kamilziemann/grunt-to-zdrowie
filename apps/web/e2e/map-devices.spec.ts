// Ekran mapy na tabletach i telefonie poziomo (emulacja w Chromium): ponizej 1024 px uklad telefonu (mapa na caly
// ekran, szyna kafli, arkusz), od 1024 px panel boczny. Naglowek w jednej linii, bez przewijania w poziomie, przyciski
// mapy odsloniete takze przy otwartym panelu warstw.
import type { Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { boxOf, expectMapButtonsUncovered, mapButtons } from './support/map-layout';
import { waitForMap } from './support/map-services';
import { expect, test } from './support/test';

async function openParcelMap(page: Page) {
  await mockBasemap(page);
  await mockAnalysisApi(page);
  await mockHydroApi(page);
  await page.route('**/api/parcels/boundaries**', (route) =>
    route.fulfill({ json: { items: [], truncated: false } }),
  );
  await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
  await waitForMap(page);
}

/** Naglowek w jednej linii: nazwa i linki nie lamia sie (wysokosc jednej linii tekstu). */
async function expectHeaderOneLine(page: Page) {
  const header = page.getByRole('banner');
  const links = header.getByRole('navigation').getByRole('link');

  expect((await boxOf(header)).height).toBeLessThanOrEqual(64);

  for (const link of await links.all()) {
    if (await link.isVisible()) expect((await boxOf(link)).height).toBeLessThanOrEqual(48);
  }
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
}

test.describe('mapa na tabletach', () => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
  ]) {
    test.describe(`pion ${viewport.width} px`, () => {
      test.use({ viewport, hasTouch: true, isMobile: true });

      test('układ telefonu: mapa na cały ekran, szyna kafli, nagłówek w jednej linii', async ({ page }) => {
        await openParcelMap(page);

        await expectHeaderOneLine(page);
        await expectNoHorizontalScroll(page);
        await expect(page.getByTestId('basemap-toggle')).toBeVisible();
        await expect(page.getByTestId('legend-button')).toBeVisible();
        await expect(page.getByRole('link', { name: /Analizuj/ })).toBeInViewport({ ratio: 1 });

        const panel = page.getByTestId('parcels-panel');

        expect((await boxOf(panel)).width).toBe(viewport.width);
        await expectMapButtonsUncovered(page, [
          page.getByRole('searchbox'),
          page.getByTestId('legend-button'),
          panel,
        ]);

        await page.getByTestId('layers-button').click();
        await expectMapButtonsUncovered(page, [page.getByTestId('layers-panel')]);
      });
    });
  }

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
  ]) {
    test.describe(`poziom ${viewport.width} px`, () => {
      test.use({ viewport, hasTouch: true, isMobile: true });

      test('panel boczny, przyciski w jednym rzędzie, przybliżanie odsłonięte', async ({ page }) => {
        await openParcelMap(page);

        await expectHeaderOneLine(page);
        await expectNoHorizontalScroll(page);

        // przyciski z napisami w jednym rzedzie (nie lamia sie na dwa)
        const row = await Promise.all(
          ['layers-button', 'basemap-switch', 'imagery-button'].map((id) => boxOf(page.getByTestId(id))),
        );

        expect(new Set(row.map((box) => Math.round(box.y))).size).toBe(1);

        await expectMapButtonsUncovered(page, [
          page.getByTestId('layers-button'),
          page.getByTestId('basemap-switch'),
          page.getByTestId('imagery-button'),
          page.getByTestId('parcels-panel'),
        ]);

        await page.getByTestId('layers-button').click();
        await expectMapButtonsUncovered(page, [page.getByTestId('layers-panel')]);

        for (const button of mapButtons(page)) await expect(button).toBeInViewport({ ratio: 1 });
      });
    });
  }
});
