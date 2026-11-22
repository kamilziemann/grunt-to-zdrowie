import type { Locator, Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { CONTEXT_TILES, mockContextApi } from './support/context-api';
import { expectNoZoomFont } from './support/font-size';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { mockImageryApi } from './support/imagery-api';
import { openImagery, setLayer, waitForMap } from './support/map-services';
import { expectTouchTargets } from './support/touch-targets';
import { expect, test } from './support/test';

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();

  expect(box, 'element widoczny na ekranie').not.toBeNull();

  return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Przyciski MapLibre: przybliz, oddal, pokaz moje polozenie (bez geolokalizacji w przegladarce testu nazywa sie
 * "Polozenie niedostepne", wiec bierzemy go po klasie). */
function mapButtons(page: Page): Locator[] {
  const map = page.getByTestId('parcel-map');

  return [
    map.getByRole('button', { name: 'Przybliż' }),
    map.getByRole('button', { name: 'Oddal' }),
    map.locator('.maplibregl-ctrl-geolocate'),
  ];
}

/** Zaden z elementow sterujacych nie wchodzi na przyciski mapy (porownanie prostokatow). */
async function expectMapButtonsUncovered(page: Page, others: readonly Locator[]) {
  const buttons = await Promise.all(mapButtons(page).map(boxOf));
  const covering = await Promise.all(others.map(boxOf));

  for (const button of buttons) {
    for (const [index, other] of covering.entries()) {
      expect(overlaps(button, other), `element ${index} zaslania przycisk mapy`).toBe(false);
    }
  }
}

// Uklad ekranu mapy na telefonie: wyszukiwarka na gorze, jeden rzad pigulek, przyciski mapy po prawej pod nimi,
// pigulka "Legenda" nad niskim arkuszem. Podklad, dzialka, kafle i zdjecie z satelity sa podstawione.
test.describe('mapa na telefonie', () => {
  test.beforeEach(async ({ page }) => {
    await mockBasemap(page);
    await mockAnalysisApi(page);
    await mockContextApi(page, { tiles: CONTEXT_TILES });
    await mockImageryApi(page);
    await page.route('**/api/parcels/boundaries**', (route) =>
      route.fulfill({ json: { items: [], truncated: false } }),
    );
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 360, height: 740 },
  ]) {
    test.describe(`${viewport.width} px`, () => {
      test.use({ viewport, hasTouch: true });

      test('wyszukiwarka na górze, pigułki w jednym rzędzie, nic nie zasłania przycisków mapy', async ({
        page,
      }) => {
        await mockHydroApi(page);
        await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
        await waitForMap(page);

        const search = page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' });
        const basemap = page.getByTestId('basemap-switch');
        const layers = page.getByTestId('layers-button');
        const imagery = page.getByTestId('imagery-button');
        const pill = page.getByTestId('legend-button');
        const sheet = page.getByTestId('parcels-panel');

        await expect(pill).toBeVisible();
        await expect(search).toBeInViewport({ ratio: 1 });
        await expectNoZoomFont(search);

        // jeden rzad: te same wspolrzedne y, kazda pigulka cala na ekranie, rzad sie nie przewija
        const [searchBox, ...row] = await Promise.all([search, basemap, layers, imagery].map(boxOf));

        expect(new Set(row.map((box) => Math.round(box.y))).size).toBe(1);
        expect(row[0]?.y ?? 0).toBeGreaterThanOrEqual((searchBox?.y ?? 0) + (searchBox?.height ?? 0));

        for (const item of [basemap, layers, imagery]) await expect(item).toBeInViewport({ ratio: 1 });

        const scroll = await page
          .getByTestId('map-controls-row')
          .evaluate((element) => element.scrollWidth - element.clientWidth);

        expect(scroll).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

        await expectMapButtonsUncovered(page, [search, basemap, layers, imagery, pill, sheet]);
        await expectTouchTargets(page.getByTestId('map-controls-row').getByRole('button'));
        await expectTouchTargets(pill);

        // podklad: krotki podpis na ekranie, pelna nazwa dla czytnikow
        await expect(basemap.getByRole('button', { name: 'Zdjęcie lotnicze', exact: true })).toHaveText(
          'Zdjęcie',
          { useInnerText: true },
        );
      });
    });
  }

  test.describe('375 px', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('podpowiedź na mapie nie zasłania przycisków mapy', async ({ page }) => {
      await mockHydroApi(page);
      await page.goto('/mapa');
      await waitForMap(page);
      // pierwsze wejscie: arkusz do polowy - stukniecie w oddalona mape prosi o przyblizenie
      await page.getByTestId('parcel-map').click({ position: { x: 150, y: 260 } });

      const hint = page.getByText('Przybliż mapę, żeby wskazać działkę.');

      await expect(hint).toBeVisible();
      await expectMapButtonsUncovered(page, [
        hint,
        page.getByRole('searchbox'),
        page.getByTestId('layers-button'),
      ]);
    });

    test('kolejność fokusu: wyszukiwarka, pigułki, mapa, arkusz', async ({ page }) => {
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);

      const order = await page.evaluate(() => {
        const items = [
          'search:not(.max-md\\:hidden) input',
          '[data-testid=basemap-switch]',
          '[data-testid=imagery-button]',
          '[data-testid=parcel-map]',
          '[data-testid=parcels-panel]',
        ].flatMap((selector) => {
          const element = document.querySelector(selector);

          return element ? [element] : [];
        });

        return (
          items.length === 5 &&
          items.slice(1).every((item, index) => {
            const previous = items[index];

            return (
              previous !== undefined &&
              (previous.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) > 0
            );
          })
        );
      });

      expect(order).toBe(true);
    });

    test('błąd formatu przy polu; po wyszukaniu klawiatura się chowa, wynik w arkuszu do połowy', async ({
      page,
    }) => {
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);

      const search = page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' });
      const panel = page.getByTestId('parcels-panel');

      await expect(panel).toHaveAttribute('data-snap', 'peek');
      await search.fill('1');
      await search.press('Enter');

      const alert = page.getByRole('alert');

      await expect(alert).toHaveText('Wpisz co najmniej 3 znaki, np. Dąbrowa 12.');
      await expect(alert).toBeInViewport({ ratio: 1 });
      expect((await boxOf(alert)).y).toBeLessThan((await boxOf(search)).y + 80);
      // zly format nie podnosi arkusza - komunikat jest przy polu
      await expect(panel).toHaveAttribute('data-snap', 'peek');

      await search.fill(PARCEL_ID);
      await search.press('Enter');
      await expect(panel).toHaveAttribute('data-snap', 'half');
      await expect(search).not.toBeFocused();
      await expect(page.getByTestId('parcel-preview')).toBeInViewport();
    });

    test('pigułka legendy ostrzega przy problemie z warstwą; panel: jedna rozwinięta legenda naraz, axe', async ({
      page,
    }) => {
      await mockHydroApi(page, { status: 503 });
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);
      await setLayer(page, 'Drzewa', true);
      await page.keyboard.press('Escape');
      await openImagery(page);
      await page.getByTestId('imagery-switch').getByText('Kondycja roślin', { exact: true }).click();

      const pill = page.getByTestId('legend-button');
      const hydro = page.getByTestId('hydro-legend');
      const context = page.getByTestId('context-legend');
      const imagery = page.getByTestId('imagery-legend');

      await expect(hydro).toHaveAttribute('data-hydro-state', 'unavailable', { timeout: 20_000 });
      await expect(imagery).toHaveAttribute('data-imagery-state', 'ready');
      await expect(pill).toHaveAttribute('data-legend-status', 'attention');
      await expect(pill).toHaveAccessibleName('Legenda mapy: Kondycja roślin, sprawdź komunikat');

      // otwiera sie najbardziej aktualna legenda (zdjecie z satelity); komunikat warstwy rowow widac w panelu
      await pill.click();
      await expect(imagery.locator('details')).toHaveAttribute('open', '');
      await expect(hydro.getByRole('status')).toBeVisible();
      await expectNoViolations(page);

      await context.getByText('Legenda: otoczenie pola').click();
      await expect(context).toHaveAttribute('open', '');
      await expect(imagery.locator('details')).not.toHaveAttribute('open');
      await expect(hydro).not.toHaveAttribute('open');

      // stukniecie w mape zamyka panel
      await page.getByTestId('parcel-map').click({ position: { x: 200, y: 200 } });
      await expect(page.getByTestId('map-legends')).toBeHidden();
    });

    test('tryb „własne pole”: wyszukiwarka i pigułki ustępują podpowiedzi, przyciski mapy odsłonięte', async ({
      page,
    }) => {
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}&rysuj=podziel`);
      await waitForMap(page);

      const hint = page.getByTestId('field-draw-hint');

      await expect(hint).toBeVisible();
      await expect(page.getByRole('searchbox')).toBeHidden();
      await expect(page.getByTestId('layers-button')).toBeHidden();
      await expect(page.getByTestId('legend-button')).toBeHidden();
      await expectMapButtonsUncovered(page, [hint, page.getByTestId('parcels-panel')]);
    });
  });
});
