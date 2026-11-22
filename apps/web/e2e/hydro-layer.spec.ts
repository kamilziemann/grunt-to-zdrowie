import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { setLayer } from './support/map-services';
import { expect, test } from './support/test';

// Warstwa "Rowy i cieki" na mapie dzialek. Podklad, dzialka i kafle hydrografii sa podstawione (bez uslug
// zewnetrznych); mapa dojezdza do dzialki z adresu, wiec przyblizenie wystarcza do pobrania kafli.
test.describe('rowy i cieki na mapie', () => {
  test.beforeEach(async ({ page }) => {
    await mockBasemap(page);
    await mockAnalysisApi(page);
    await page.route('**/api/parcels/boundaries**', (route) => route.fulfill({ json: { items: [] } }));
  });

  test('włączona domyślnie w panelu warstw, kafle wokół działki, legenda ze źródłem i datą danych', async ({
    page,
  }) => {
    const requested = await mockHydroApi(page);

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);

    const legend = page.getByTestId('hydro-legend');

    await expect(legend).toHaveAttribute('data-hydro-state', 'ready', { timeout: 20_000 });
    expect(requested).toContain('9174/5399');

    // legenda jest domyslnie zwinieta (takze na komputerze) - rozwija sie jednym kliknieciem
    await expect(legend).not.toHaveAttribute('open');
    await legend.getByText('Legenda: rowy i cieki').click();
    await expect(legend).toHaveAttribute('open', '');
    await expect(legend.getByText('Rów melioracyjny')).toBeVisible();
    await expect(legend).toContainText('Mokradło, bagno');
    await expect(legend).toContainText('Źródło: BDOT10k, GUGiK · dane z 21 lis 2026');

    await setLayer(page, 'Rowy i cieki', false);
    await expect(legend).toBeHidden();
  });

  test('503 z API: spokojny komunikat „chwilowo niedostępna”, mapa działa dalej', async ({ page }) => {
    await mockHydroApi(page, { status: 503 });
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);

    const legend = page.getByTestId('hydro-legend');

    await expect(legend).toHaveAttribute('data-hydro-state', 'unavailable', { timeout: 20_000 });
    await expect(legend.getByRole('status')).toHaveText(
      'Warstwa rowów i cieków jest chwilowo niedostępna. Reszta mapy działa normalnie.',
    );
    await expect(page.getByTestId('parcel-map')).toHaveAttribute('data-map-state', 'ready');
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('legenda w pigułce nad arkuszem, panel z jedną otwartą legendą, bez poziomego przewijania', async ({
      page,
    }) => {
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);

      const legend = page.getByTestId('hydro-legend');
      const pill = page.getByTestId('legend-button');

      await expect(legend).toHaveAttribute('data-hydro-state', 'ready', { timeout: 20_000 });
      // na mapie tylko pigulka "Legenda" w lewym dolnym rogu, tuz nad arkuszem
      await expect(legend).toBeHidden();
      await expect(pill).toHaveText('Legenda');

      const pillBox = await pill.boundingBox();
      const sheetBox = await page.getByTestId('parcels-panel').boundingBox();

      expect((pillBox?.y ?? 0) + (pillBox?.height ?? 0)).toBeLessThanOrEqual(sheetBox?.y ?? 0);
      expect(pillBox?.x ?? 0).toBeLessThan(375 / 2);

      // panel od dolu: jedyna legenda rozwinieta od razu; Escape zamyka i oddaje fokus pigulce
      await pill.click();
      await expect(legend).toBeInViewport();
      await expect(legend).toHaveAttribute('open', '');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('map-legends')).toBeHidden();
      await expect(pill).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });
});
