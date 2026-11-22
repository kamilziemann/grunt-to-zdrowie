import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { basemapButton, mockMapServices, waitForMap } from './support/map-services';
import { expectTouchTargets } from './support/touch-targets';
import { expect, test } from './support/test';
import { expectNoZoomFont } from './support/font-size';

// Ekran wyboru dzialek. Testy nie wolaja ULDK ani podkladu (zewnetrzne uslugi): podklad i kafle mapy sa podstawione
// (`mockMapServices`), a testy sprawdzaja uklad, walidacje pola i przejscia, ktore nie potrzebuja danych dzialki.
// Przeplyw z prawdziwa dzialka jest sprawdzany recznie (docs/plans).
test.describe('działki', () => {
  test.beforeEach(async ({ page }) => {
    await mockMapServices(page);
  });

  test(
    'mapa: pierwsze wejście pokazuje jak wskazać działkę i zablokowany następny krok',
    { tag: '@smoke' },
    async ({ page }) => {
      await page.goto('/mapa');
      await waitForMap(page);

      await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
      // pierwsze wejscie: trzy kroki "jak wskazac dzialke" zamiast paska etapow
      await expect(page.getByTestId('map-intro').locator('ol > li')).toHaveText([
        /Przybliż mapę/,
        /Kliknij swoją działkę/,
        /Sprawdź, czy to ta działka/,
      ]);
      await expect(page.getByRole('list', { name: 'Etapy' })).toBeHidden();
      await expect(page.getByRole('application', { name: /Mapa/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Analizuj działkę' })).toBeDisabled();
      await expect(page.getByText('Nie masz jeszcze żadnej działki')).toBeVisible();
    },
  );

  test('dodanie i usunięcie działki potwierdza powiadomienie (lista bywa w zwiniętym arkuszu)', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await page.goto('/mapa');
    await page.getByLabel('Numer działki, obręb z numerem albo adres').fill(PARCEL_ID);
    await page.keyboard.press('Enter');

    const toasts = page.getByTestId('toasts');

    await page.getByRole('button', { name: 'Dodaj do moich działek' }).click();
    await expect(toasts).toContainText('Dodano działkę 6509 do Twoich działek');
    await expect(page).toHaveURL(/dzialki=/);

    await page.getByRole('button', { name: 'Usuń działkę 6509' }).click();
    await expect(toasts).toContainText('Usunięto działkę 6509 z listy');
    // powiadomienie nie przejmuje fokusu i znika samo (domyslnie po 5 s)
    await expect(toasts.getByRole('listitem')).toHaveCount(0, { timeout: 12_000 });
  });

  test('stary adres z listą działek przekierowuje na mapę', async ({ page }) => {
    await page.goto('/?dzialki=080904_5.0001.349%2F1');
    await expect(page).toHaveURL(/\/mapa\?dzialki=080904_5\.0001\.349%2F1$/);
  });

  test('przykłady na stronie głównej: każdy jednym kliknięciem otwiera gotowy raport', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto('/');

    const examples = page.getByTestId('examples');

    await expect(examples.getByRole('link')).toHaveCount(4);
    await expect(examples.getByText('Przykład')).toHaveCount(4);
    await expect(examples.locator('[data-example="ditch"]')).toHaveAttribute(
      'href',
      '/raport?dzialki=080904_5.0001.349%2F1&uprawa=winter_wheat&data=2018-06-15',
    );
    await expect(examples.locator('[data-example="dry"]')).toHaveAttribute(
      'href',
      /uprawa=spring_barley&data=2023-06-20/,
    );
    await expect(examples.locator('[data-example="wet"]')).toHaveAttribute(
      'href',
      /uprawa=grassland&data=2017-09-20/,
    );
    // "dzis" liczy przegladarka - po hydratacji link prowadzi do raportu z dzisiejsza data
    await expect(examples.locator('[data-example="today"]')).toHaveAttribute(
      'href',
      /^\/raport\?dzialki=142909_2\.0013\.178&uprawa=winter_wheat&data=\d{4}-\d{2}-\d{2}$/,
    );
    await expect(examples.getByRole('link', { name: /Mokry rok: za dużo wody/ })).toContainText(
      'nadmiarem wody',
    );

    await examples.locator('[data-example="ditch"]').click();
    await expect(page).toHaveURL(
      /\/raport\?dzialki=080904_5\.0001\.349%2F1&uprawa=winter_wheat&data=2018-06-15/,
    );
    await expect(page.getByTestId('short-analysis')).toBeVisible();
  });

  test('za krótki tekst pokazuje podpowiedź zamiast wysyłać zapytanie', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/parcels')) requests.push(request.url());
    });

    await page.goto('/mapa');
    await waitForMap(page);
    await page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' }).fill('12');
    await page.getByRole('button', { name: 'Szukaj' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Wpisz co najmniej 3 znaki' })).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('podkład przy mapie: zdjęcie lotnicze zamiast mapy', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/mapa');
    await waitForMap(page);

    const map = basemapButton(page, 'Mapa');
    const photo = basemapButton(page, 'Zdjęcie lotnicze');

    await expect(map).toHaveAttribute('aria-pressed', 'true');
    await photo.click();
    await expect(photo).toHaveAttribute('aria-pressed', 'true');
    await expect(map).toHaveAttribute('aria-pressed', 'false');
  });

  test('pusta lista na ekranie analizy odsyła do mapy', async ({ page }) => {
    await page.goto('/analiza');
    await expect(page.getByRole('heading', { level: 1, name: 'Nie wybrano żadnej działki' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wpisz numer działki' })).toHaveAttribute('href', '/');
    await page.getByRole('link', { name: 'Wskaż działkę na mapie' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('arkusz od dołu: pierwsze wejście do połowy z podpowiedzią, rozwija się, strona się nie przewija', async ({
      page,
    }) => {
      await page.goto('/mapa');
      await waitForMap(page);

      const panel = page.getByTestId('parcels-panel');
      const search = page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' });

      // pierwsze wejscie: arkusz do polowy z podpowiedzia; pole wyszukiwania na gorze mapy, nad arkuszem
      await expect(panel).toHaveAttribute('data-snap', 'half');
      await expect(search).toBeInViewport({ ratio: 1 });
      expect((await search.boundingBox())?.y ?? 0).toBeLessThan((await panel.boundingBox())?.y ?? 0);
      await expect(page.getByTestId('map-intro')).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Analizuj działkę' })).toBeInViewport();
      // tytul ekranu na telefonie tylko dla czytnikow - miejsce w arkuszu nalezy do wynikow
      await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toHaveCount(1);

      await page.getByRole('button', { name: 'Rozwiń panel' }).click();
      await expect(panel).toHaveAttribute('data-snap', 'full');

      // pole 16 px: iOS nie przybliza strony przy fokusie; brak poziomego przewijania
      await expectNoZoomFont(search);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      await expectTouchTargets(panel.getByRole('button'));
      await expectTouchTargets(page.getByTestId('layers-button'));
    });

    test('krok działki po powrocie z mapy zaczyna się od góry, choć wcześniej był przewinięty', async ({
      page,
    }) => {
      await mockAnalysisApi(page);
      await page.goto(`/analiza?dzialki=${PARCEL_ID}`);
      await expect(page.getByText('Działka 6509')).toBeVisible();

      // rolnik przewija panel do "Moje pole to kilka dzialek" (na telefonie pod zgieciem) i idzie na mape
      const many = page.getByRole('link', { name: 'Moje pole to kilka działek' });

      await many.scrollIntoViewIfNeeded();
      await many.click();
      await expect(page).toHaveURL(/\/mapa\?/);
      await page.getByRole('link', { name: 'Analizuj działkę' }).click();
      await expect(page).toHaveURL(/\/analiza\?/);

      await expect(page.getByRole('heading', { level: 1, name: 'Czy to Twoja działka?' })).toBeInViewport();
      expect(await page.getByTestId('check-panel').evaluate((panel) => panel.scrollTop)).toBe(0);
    });
  });
});
