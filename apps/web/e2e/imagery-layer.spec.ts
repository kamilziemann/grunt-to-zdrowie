import type { Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { mockImageryApi } from './support/imagery-api';
import { openImagery } from './support/map-services';
import { expect, test } from './support/test';

/** Wybor obrazu w panelu "Satelita" klikiem w etykiete (radio jest ukryte wizualnie, jak w grupie przelacznikow). */
async function chooseLayer(page: Page, name: string) {
  await openImagery(page);
  await page.getByTestId('imagery-switch').getByText(name, { exact: true }).click();
  await expect(page.getByRole('radio', { name })).toBeChecked();
  // panel lezy nad legendami - zamykamy go jak rolnik (Escape), zeby siegnac legendy
  await page.keyboard.press('Escape');
}

// Warstwy "Kondycja roslin" i "Woda w roslinach" na mapie dzialek. Podklad, dzialka, rowy i obraz z satelity sa
// podstawione (bez uslug zewnetrznych). Obraz pobieramy dopiero po wlaczeniu warstwy, jednym zapytaniem.
test.describe('zdjęcie z satelity na mapie', () => {
  test.beforeEach(async ({ page }) => {
    await mockBasemap(page);
    await mockAnalysisApi(page);
    await mockHydroApi(page);
    await page.route('**/api/parcels/boundaries**', (route) => route.fulfill({ json: { items: [] } }));
  });

  test('bez działek przełącznik jest nieaktywny z podpowiedzią', async ({ page }) => {
    const imagery = await mockImageryApi(page);

    await page.goto('/mapa');
    await openImagery(page);

    const group = page.getByRole('group', { name: 'Zdjęcie z satelity' });

    await expect(group.getByRole('radio', { name: 'Kondycja roślin' })).toBeDisabled();
    await expect(group).toContainText('Najpierw wybierz działkę');
    expect(imagery.requests).toHaveLength(0);
  });

  test('pobiera dopiero po włączeniu, raz na warstwę; legenda zwinięta, z datą i ograniczeniami', async ({
    page,
  }) => {
    const imagery = await mockImageryApi(page);

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await expect(page.getByTestId('parcel-map')).toHaveAttribute('data-map-state', 'ready');
    expect(imagery.requests).toHaveLength(0);

    await chooseLayer(page, 'Kondycja roślin');

    const legend = page.getByTestId('imagery-legend');

    await expect(legend).toHaveAttribute('data-imagery-state', 'ready');
    expect(imagery.requests).toEqual([`/api/imagery/vegetation?dzialki=${PARCEL_ID}&warstwa=condition`]);

    // legenda domyslnie zwinieta - jeden wiersz
    const details = legend.locator('details');

    await expect(details).not.toHaveAttribute('open');
    await legend.getByText('Legenda: kondycja roślin').click();
    await expect(legend).toContainText('Zdjęcie satelitarne z 29 maja 2018.');
    await expect(legend).toContainText('słabiej');
    await expect(legend).toContainText('na działce poniżej ok. 1 ha widać tylko kilkadziesiąt kwadratów');
    await expect(legend).toContainText('Dla doradcy: NDVI');

    await chooseLayer(page, 'Woda w roślinach');
    await expect(legend).toHaveAttribute('data-imagery-state', 'ready');
    await expect(legend).toContainText('wilgotność roślin, nie gleby');
    await expect(legend).toContainText('sucho');

    // powrot do warstwy, ktora juz byla, nie pyta drugi raz
    await chooseLayer(page, 'Kondycja roślin');
    await expect(legend).toHaveAttribute('data-imagery-state', 'ready');
    await chooseLayer(page, 'Brak');
    await expect(legend).toBeHidden();
    expect(imagery.requests).toHaveLength(2);

    // wybrany miesiac = ostatni dzien miesiaca w zapytaniu
    await chooseLayer(page, 'Kondycja roślin');
    await openImagery(page);
    await page.getByLabel('Z kiedy').selectOption({ label: 'czerwiec 2018' });
    await page.keyboard.press('Escape');
    await expect(legend).toHaveAttribute('data-imagery-state', 'ready');
    expect(imagery.requests.at(-1)).toContain('data=2018-06-30');

    await expectNoViolations(page);
  });

  test('brak kluczy, brak czystego zdjęcia i limit Copernicus: komunikaty, ponowienie, mapa działa', async ({
    page,
  }) => {
    const imagery = await mockImageryApi(page, { kind: 'problem', status: 503, code: 'not_configured' });

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await chooseLayer(page, 'Kondycja roślin');

    const legend = page.getByTestId('imagery-legend');

    await expect(legend).toHaveAttribute('data-imagery-state', 'notConfigured');
    await expect(legend.getByRole('status')).toContainText('nie są jeszcze włączone');
    await expect(page.getByTestId('parcel-map')).toHaveAttribute('data-map-state', 'ready');

    imagery.respondWith({ kind: 'problem', status: 404, code: 'not_found', reason: 'no_clear_scene' });
    await chooseLayer(page, 'Woda w roślinach');
    await expect(legend).toHaveAttribute('data-imagery-state', 'noClearScene');
    await expect(legend.getByRole('status')).toContainText('Brak czystego zdjęcia');

    imagery.respondWith({ kind: 'problem', status: 502, code: 'upstream_failed' });
    await openImagery(page);
    await page.getByLabel('Z kiedy').selectOption({ label: 'czerwiec 2018' });
    await page.keyboard.press('Escape');
    await expect(legend).toHaveAttribute('data-imagery-state', 'busy');

    imagery.respondWith({ kind: 'ok' });
    await legend.getByRole('button', { name: 'Spróbuj ponownie' }).click();
    await expect(legend).toHaveAttribute('data-imagery-state', 'ready');
    expect(imagery.requests).toHaveLength(4);
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('wybór zdjęcia chowa panel, legenda mieści się na mapie, bez poziomego przewijania', async ({
      page,
    }) => {
      await mockImageryApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await openImagery(page);
      await page.getByTestId('imagery-switch').getByText('Woda w roślinach', { exact: true }).click();
      await expect(page.getByTestId('imagery-panel')).toBeHidden();

      const legend = page.getByTestId('imagery-legend');

      await expect(legend).toHaveAttribute('data-imagery-state', 'ready');

      const box = await legend.boundingBox();

      expect(box?.height).toBeLessThanOrEqual(48);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });
});
