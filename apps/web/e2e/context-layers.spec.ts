import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { CONTEXT_TILES, mockContextApi } from './support/context-api';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { basemapButton, openLayers, setLayer, waitForMap } from './support/map-services';
import { expectTouchTargets } from './support/touch-targets';
import { expect, test } from './support/test';

// Panel "Warstwy" i warstwy otoczenia pola (drzewa, budowle wodne i waly, obszary chronione). Podklad, dzialka i kafle
// sa podstawione (bez uslug zewnetrznych i bazy); mapa dojezdza do dzialki z adresu, wiec kafle sa w zasiegu.
test.describe('warstwy otoczenia pola', () => {
  test.beforeEach(async ({ page }) => {
    await mockBasemap(page);
    await mockAnalysisApi(page);
    await mockHydroApi(page, { tiles: {} });
    await page.route('**/api/parcels/boundaries**', (route) =>
      route.fulfill({ json: { items: [], truncated: false } }),
    );
  });

  test('domyślnie wyłączone i nic nie pobierają; włączona warstwa pyta tylko o siebie, legenda z datą', async ({
    page,
  }) => {
    const requested = await mockContextApi(page);

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);
    await expect(page.getByTestId('hydro-legend')).toHaveAttribute('data-hydro-state', 'ready');
    expect(requested).toEqual([]);

    await openLayers(page);

    const panel = page.getByTestId('layers-panel');

    // grupy panelu i domyslny zestaw: granice i rowy wlaczone, reszta wylaczona; podklad i zdjecie z satelity
    // maja wlasne przyciski przy mapie
    await expect(panel.getByRole('group')).toHaveText([/^Działki/, /^Woda i otoczenie/]);
    await expect(page.getByTestId('basemap-switch')).toBeVisible();
    await expect(page.getByTestId('imagery-button')).toBeVisible();
    await expect(panel.getByRole('checkbox', { name: 'Granice działek' })).toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'Rowy i cieki' })).toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'Drzewa' })).not.toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'Drzewa' })).toHaveAccessibleDescription(
      /osłaniają pole/,
    );
    await expect(page.getByTestId('layers-button')).toHaveAccessibleName('Warstwy mapy, włączone: 2');

    await setLayer(page, 'Drzewa', true);

    const legend = page.getByTestId('context-legend');

    await expect(legend).toHaveAttribute('data-context-state', 'ready');
    expect(requested).toContain('cover 9174/5399');
    expect(requested.every((entry) => entry.startsWith('cover '))).toBe(true);
    await expect(page.getByTestId('layers-button')).toHaveAccessibleName('Warstwy mapy, włączone: 3');

    await setLayer(page, 'Obszary chronione', true);
    await expect.poll(() => requested.some((entry) => entry.startsWith('protected '))).toBe(true);
    expect(requested.some((entry) => entry.startsWith('waterworks '))).toBe(false);

    // legenda zwinieta: rozwija sie jednym kliknieciem i pokazuje tylko wlaczone warstwy
    await page.keyboard.press('Escape');
    await expect(legend).not.toHaveAttribute('open');
    await legend.getByText('Legenda: otoczenie pola').click();
    await expect(legend.getByRole('region', { name: 'Drzewa' })).toContainText('Rząd drzew');
    await expect(legend.getByRole('region', { name: 'Obszary chronione' })).toContainText(
      'Obszar Natura 2000',
    );
    await expect(legend.getByRole('region', { name: 'Budowle wodne i wały' })).toHaveCount(0);
    await expect(legend).toContainText('Źródło: BDOT10k, GUGiK · dane z 21 lis 2026');

    // harmonijka: rozwiniecie legendy rowow zwija legende otoczenia - naraz otwarta jest jedna
    const hydroLegend = page.getByTestId('hydro-legend');

    await expect(legend).toHaveAttribute('open', '');
    await hydroLegend.getByText('Legenda: rowy i cieki').click();
    await expect(hydroLegend).toHaveAttribute('open', '');
    await expect(legend).not.toHaveAttribute('open');
    await legend.getByText('Legenda: otoczenie pola').click();
    await expect(legend).toHaveAttribute('open', '');
    await expect(hydroLegend).not.toHaveAttribute('open');
  });

  test('baza nie odpowiada (503): komunikat w legendzie, mapa i rowy działają dalej', async ({ page }) => {
    await mockContextApi(page, { status: 503 });
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);
    await setLayer(page, 'Budowle wodne i wały', true);
    await page.keyboard.press('Escape');

    const legend = page.getByTestId('context-legend');

    await expect(legend).toHaveAttribute('data-context-state', 'unavailable');
    await expect(legend.getByRole('status')).toHaveText(
      'Baza otoczenia pola chwilowo nie odpowiada. Reszta mapy działa normalnie.',
    );
    await expect(page.getByTestId('hydro-legend')).toHaveAttribute('data-hydro-state', 'ready');
  });

  test('obcięty kafel rysujemy, a legenda prosi o przybliżenie', async ({ page }) => {
    await mockContextApi(page, { tiles: { cover: { ...CONTEXT_TILES.cover, truncated: true } } });
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);
    await setLayer(page, 'Drzewa', true);
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('context-legend').getByRole('status')).toHaveText(
      'W tym miejscu pokazujemy część obiektów – przybliż, żeby zobaczyć wszystko.',
    );
  });

  test('wybór warstw zostaje po przejściu do analizy i powrocie', async ({ page }) => {
    await mockContextApi(page);
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);
    await setLayer(page, 'Obszary chronione', true);
    await setLayer(page, 'Rowy i cieki', false);
    await page.keyboard.press('Escape');
    await basemapButton(page, 'Zdjęcie lotnicze').click();

    await page.getByRole('link', { name: /Analizuj/ }).click();
    await expect(page).toHaveURL(/\/analiza/);
    await page.goBack();
    await waitForMap(page);
    await openLayers(page);

    const panel = page.getByTestId('layers-panel');

    await expect(panel.getByRole('checkbox', { name: 'Obszary chronione' })).toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'Rowy i cieki' })).not.toBeChecked();
    await expect(basemapButton(page, 'Zdjęcie lotnicze')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('hydro-legend')).toHaveCount(0);
  });

  test('panel z klawiatury: Enter otwiera, spacja przełącza, Escape zamyka i oddaje fokus; axe bez naruszeń', async ({
    page,
  }) => {
    await mockContextApi(page);
    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await waitForMap(page);

    const button = page.getByTestId('layers-button');
    const panel = page.getByTestId('layers-panel');

    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();

    const trees = panel.getByRole('checkbox', { name: 'Drzewa' });

    await trees.focus();
    await page.keyboard.press('Space');
    await expect(trees).toBeChecked();
    await expect(page.getByTestId('context-legend')).toBeVisible();
    await expectNoViolations(page);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('panel jako arkusz od dołu nad mapą, cele dotykowe ≥ 44 px, bez poziomego przewijania', async ({
      page,
    }) => {
      await mockContextApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);
      await openLayers(page);

      const panel = page.getByTestId('layers-panel');
      const box = await panel.boundingBox();

      // arkusz siega dolu ekranu i zostawia mape widoczna nad soba
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(812);
      expect(box?.y ?? 0).toBeGreaterThan(150);
      await expect(page.getByRole('button', { name: 'Zamknij warstwy' })).toBeInViewport();
      await expectTouchTargets(panel.locator('label:has(input), button'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

      // stukniecie w mape zamyka panel
      await page.getByTestId('parcel-map').tap({ position: { x: 300, y: 140 } });
      await expect(panel).toBeHidden();
    });
  });
});
