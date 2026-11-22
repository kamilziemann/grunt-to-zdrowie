import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { CONTEXT_TILES, mockContextApi } from './support/context-api';
import { expectNoZoomFont } from './support/font-size';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { mockImageryApi } from './support/imagery-api';
import { boxOf, expectMapButtonsUncovered, mapButtons } from './support/map-layout';
import { openImagery, setLayer, waitForMap } from './support/map-services';
import { expectTouchTargets } from './support/touch-targets';
import { expect, test } from './support/test';

// Uklad ekranu mapy na telefonie: wyszukiwarka na gorze, pod nia przy prawej krawedzi szyna kafli z podpisami (warstwy,
// zdjecie, satelita, przyblizanie, gdzie jestem), pigulka "Legenda" nad niskim arkuszem. Podklad, dzialka, kafle
// i zdjecie z satelity sa podstawione.
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

      test('wyszukiwarka na górze, szyna kafli po prawej, nic nie zasłania przycisków mapy', async ({
        page,
      }) => {
        await mockHydroApi(page);
        await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
        await waitForMap(page);

        const search = page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' });
        const layers = page.getByTestId('layers-button');
        const basemap = page.getByTestId('basemap-toggle');
        const imagery = page.getByTestId('imagery-button');
        const pill = page.getByTestId('legend-button');
        const sheet = page.getByTestId('parcels-panel');
        const rail = [layers, basemap, imagery, ...mapButtons(page)];

        await expect(pill).toBeVisible();
        await expect(search).toBeInViewport({ ratio: 1 });
        await expectNoZoomFont(search);

        // jedna kolumna przy prawej krawedzi pod polem, w kolejnosci ze szkicu
        const searchBox = await boxOf(search);
        const boxes = await Promise.all(rail.map(boxOf));

        const rightEdge = searchBox.x + searchBox.width;

        for (const box of boxes) expect(Math.abs(box.x + box.width - rightEdge)).toBeLessThanOrEqual(2);
        expect(boxes[0]?.y ?? 0).toBeGreaterThanOrEqual(searchBox.y + searchBox.height);

        for (const [index, box] of boxes.slice(1).entries()) {
          expect(box.y).toBeGreaterThan(boxes[index]?.y ?? 0);
        }

        for (const item of rail) await expect(item).toBeInViewport({ ratio: 1 });

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

        await expectMapButtonsUncovered(page, [search, layers, basemap, imagery, pill, sheet]);
        await expectTouchTargets(page.getByTestId('map-controls-row').getByRole('button'));
        await expectTouchTargets(pill);

        // sama ikona (podpisy zaslanialy mape); krotka nazwa zostaje dla czytnikow, pelna w dymku
        await expect(layers).toContainText('Warstwy');
        await expect(imagery).toContainText('Satelita');
        await expect(page.getByRole('button', { name: 'Gdzie jestem' })).toHaveAttribute(
          'title',
          'Pokaż moje położenie',
        );
        await expect(basemap).toHaveAccessibleName('Zdjęcie lotnicze');
        await expect(basemap).toHaveText('Zdjęcie', { useInnerText: true });
        await expect(basemap).toHaveAttribute('aria-pressed', 'false');
        await basemap.click();
        await expect(basemap).toHaveAttribute('aria-pressed', 'true');
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
      // arkusz do polowy (pierwsze wejscie): szyna przechodzi do drugiej kolumny i konczy sie nad arkuszem
      await expect(page.getByTestId('parcels-panel')).toHaveAttribute('data-snap', 'half');
      await expectMapButtonsUncovered(page, [
        page.getByTestId('parcels-panel'),
        hint,
        page.getByRole('searchbox'),
        page.getByTestId('layers-button'),
      ]);
    });

    test('otwarte panele warstw, satelity i legend kończą się przed szyną - przyciski mapy odsłonięte', async ({
      page,
    }) => {
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);

      for (const [button, panel] of [
        ['layers-button', 'layers-panel'],
        ['imagery-button', 'imagery-panel'],
        ['legend-button', 'map-legends'],
      ] as const) {
        await page.getByTestId(button).click();
        await expect(page.getByTestId(panel)).toBeVisible();
        await expectMapButtonsUncovered(page, [page.getByTestId(panel)]);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(panel)).toBeHidden();
      }
    });

    test('„Gdzie jestem” bez dostępu do położenia: komunikat słowny i ostrzeżenie na kaflu', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName === 'firefox',
        'Firefox w Playwright nie zwraca bledu geolokalizacji (czeka bez konca)',
      );
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);

      const locate = page.getByRole('button', { name: 'Gdzie jestem' });

      // brak zgody w przegladarce testu
      await locate.click();
      await expect(locate).toHaveAttribute('data-locate-state', 'denied');
      await expect(page.getByText('Brak dostępu do położenia.', { exact: false })).toBeVisible();
    });

    test('„Gdzie jestem” ze zgodą: mapa pokazuje położenie', async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 52.172, longitude: 21.59 });
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);

      const locate = page.getByRole('button', { name: 'Gdzie jestem' });

      await locate.click();
      await expect(locate).toHaveAttribute('data-locate-state', 'found');
      await expect(page.getByText('Mapa pokazuje Twoje położenie')).toBeVisible();
    });

    test('kolejność fokusu: wyszukiwarka, szyna przycisków, mapa, arkusz', async ({ page }) => {
      await mockHydroApi(page);
      await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
      await waitForMap(page);

      const order = await page.evaluate(() => {
        const items = [
          'search:not(.max-lg\\:hidden) input',
          '[data-testid=layers-button]',
          '[data-testid=basemap-toggle]',
          '[data-testid=imagery-button]',
          '[data-map-button=locate]',
          '[data-testid=parcel-map]',
          '[data-testid=parcels-panel]',
        ].flatMap((selector) => {
          const element = document.querySelector(selector);

          return element ? [element] : [];
        });

        return (
          items.length === 7 &&
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

      await expect(alert).toHaveText('Wpisz co najmniej 3 znaki, np. Chwalim 349/1.');
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

    test('tryb „własne pole”: wyszukiwarka i kafle warstw ustępują podpowiedzi, przyciski mapy odsłonięte', async ({
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
