import type { Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { basemapButton, mockMapServices, waitForMap } from './support/map-services';
import { expect, test } from './support/test';

// Kadr mapy miedzy krokami: kazda strona tworzy wlasna mape, ale nowa startuje z kadru poprzedniej (srodek widocznej
// czesci mapy + przyblizenie) albo od razu na dzialce - bez przelotu z widoku calej Polski. Mapa wystawia kadr w
// atrybutach `data-map-center` i `data-map-zoom` (ustawiane po wczytaniu i po kazdym ruchu).
const CENTER_TOLERANCE = 0.0003;
const ZOOM_TOLERANCE = 0.05;

interface View {
  lng: number;
  lat: number;
  zoom: number;
}

async function readView(page: Page): Promise<View> {
  const map = page.getByTestId('parcel-map');

  await waitForMap(page);

  // oba atrybuty jednym odczytem (przy przejsciu stara mapa znika z DOM miedzy dwoma odczytami)
  let view: View | null = null;

  await expect
    .poll(async () => {
      const [center, zoom] = await map.evaluate((element) => [
        element.dataset.mapCenter ?? '',
        element.dataset.mapZoom ?? '',
      ]);
      const [lng, lat] = (center ?? '').split(',').map(Number);

      view = lng && lat && zoom ? { lng, lat, zoom: Number(zoom) } : null;

      return view !== null;
    })
    .toBe(true);

  if (!view) throw new Error('brak kadru mapy');

  return view;
}

function expectSameView(actual: View, expected: View, zoomTolerance = ZOOM_TOLERANCE) {
  expect(Math.abs(actual.lng - expected.lng)).toBeLessThanOrEqual(CENTER_TOLERANCE);
  expect(Math.abs(actual.lat - expected.lat)).toBeLessThanOrEqual(CENTER_TOLERANCE);
  expect(Math.abs(actual.zoom - expected.zoom)).toBeLessThanOrEqual(zoomTolerance);
}

/** Kadr zaraz po wczytaniu mapy i chwile pozniej: mapa nigdzie nie odlatuje (przelot zmienilby kadr po ruchu). */
async function settledView(page: Page): Promise<View> {
  const first = await readView(page);

  await page.waitForTimeout(1200);
  expectSameView(await readView(page), first);

  return first;
}

test.describe('kadr mapy między krokami', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalysisApi(page);
    await mockMapServices(page);
  });

  test('/mapa → /analiza → „Tylko część” → wstecz: ten sam kadr, bez przelotu z widoku kraju', async ({
    page,
  }) => {
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);

    // pierwsza mapa w karcie: od razu na dzialce z adresu (bez kadru z poprzedniej mapy)
    const onMap = await settledView(page);

    expect(onMap.zoom).toBeGreaterThan(15);

    await page.getByRole('link', { name: 'Analizuj działkę' }).click();
    await expect(page.getByTestId('check-map')).toBeVisible();
    expectSameView(await settledView(page), onMap);

    await page.getByRole('link', { name: 'Tylko część' }).click();
    await expect(page.getByTestId('field-draw')).toBeVisible();
    expectSameView(await settledView(page), onMap);

    await page.goBack();
    await expect(page.getByTestId('check-map')).toBeVisible();
    expectSameView(await settledView(page), onMap);
  });

  test('strona główna → numer → krok działki → „Tylko część”: mapa od razu na działce', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Numer działki albo nazwa wsi i numer' }).fill(PARCEL_ID);
    await page.getByRole('button', { name: 'Sprawdź działkę' }).first().click();
    await expect(page.getByTestId('check-map')).toBeVisible();

    // bez kadru z poprzedniej mapy: start od razu na dzialce, bez przelotu
    const onCheck = await settledView(page);

    expect(onCheck.zoom).toBeGreaterThan(15);

    await page.getByRole('link', { name: 'Tylko część' }).click();
    await expect(page.getByTestId('field-draw')).toBeVisible();
    // inna wielkosc mapy - przyblizenie moze sie roznic o dopasowanie dzialki, srodek ten sam
    expectSameView(await settledView(page), onCheck, 1);
  });

  test('kadr przesunięty przez użytkownika zostaje po powrocie z kroku działki', async ({ page }) => {
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await settledView(page);

    const map = page.getByTestId('parcel-map');
    const before = await map.getAttribute('data-map-zoom');

    await page.getByRole('button', { name: 'Oddal' }).click();
    await expect(map).not.toHaveAttribute('data-map-zoom', before ?? '');

    const zoomedOut = await settledView(page);

    await page.getByRole('link', { name: 'Analizuj działkę' }).click();
    await expect(page.getByTestId('check-map')).toBeVisible();
    await waitForMap(page);
    await page.goBack();
    await expect(page.getByTestId('check-map')).toBeHidden();
    // dzialke widac w zapamietanym kadrze, wiec mapa nie dojezdza do niej od nowa
    expectSameView(await settledView(page), zoomedOut);
  });

  test('podkład wybrany w kroku działki zostaje na mapie (i odwrotnie)', async ({ page }) => {
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);
    await basemapButton(page, 'Zdjęcie lotnicze').click();
    await page.getByRole('link', { name: 'Analizuj działkę' }).click();

    const checkMap = page.getByTestId('check-map');

    await expect(checkMap.getByRole('button', { name: 'Zdjęcie lotnicze' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await checkMap.getByRole('button', { name: 'Mapa', exact: true }).click();
    await page.getByRole('link', { name: 'Tylko część' }).click();
    await expect(page).toHaveURL(/rysuj=podziel/);
    // w trybie podzialu przelaczniki sa schowane - podklad widac po wyjsciu z trybu
    await page.getByTestId('field-draw').getByRole('button', { name: 'Anuluj' }).click();
    await expect(basemapButton(page, 'Mapa')).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('mała mapa w kroku działki: ten sam środek, powrót na mapę bez zmiany przybliżenia', async ({
      page,
    }) => {
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);

      const onMap = await settledView(page);

      await page.getByRole('link', { name: 'Analizuj działkę' }).click();
      await expect(page.getByTestId('check-map')).toBeVisible();

      // mapa kroku dzialki ma 32% wysokosci ekranu - przyblizenie moze spasc, zeby zmiescic dzialke; srodek ten sam
      const onCheck = await settledView(page);

      expectSameView(onCheck, onMap, 1);

      await page.getByRole('link', { name: 'Tylko część' }).click();
      // na telefonie panel rysowania siedzi w zwinietym arkuszu - tryb poznajemy po podpowiedzi na mapie
      await expect(page.getByTestId('field-draw-hint')).toBeVisible();
      expectSameView(await settledView(page), onMap);
    });
  });
});
