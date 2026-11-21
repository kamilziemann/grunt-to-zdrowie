import { expectTouchTargets } from './support/touch-targets';
import { expect, test } from './support/test';

// Ekran wyboru dzialek. Testy nie wolaja ULDK (zewnetrzna usluga GUGiK): sprawdzaja uklad, walidacje pola i przejscia,
// ktore nie potrzebuja danych dzialki. Przeplyw z prawdziwa dzialka jest sprawdzany recznie (docs/plans).
test.describe('działki', () => {
  test('pokazuje wyszukiwarkę, kroki i zablokowany następny krok', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Etapy' }).getByRole('listitem')).toHaveText([
      /Znajdź/,
      /Sprawdź/,
      /Analizuj/,
    ]);
    await expect(page.getByRole('application', { name: /Mapa/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analizuj działkę' })).toBeDisabled();
    await expect(page.getByText('Nie masz jeszcze żadnej działki')).toBeVisible();
  });

  test('za krótki tekst pokazuje podpowiedź zamiast wysyłać zapytanie', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/parcels')) requests.push(request.url());
    });

    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' }).fill('12');
    await page.getByRole('button', { name: 'Szukaj' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Wpisz co najmniej 3 znaki' })).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('przełącznik podkładu zmienia mapę na zdjęcie', async ({ page }) => {
    await page.goto('/');

    const photo = page.getByRole('button', { name: 'Zdjęcie' });

    await expect(photo).toHaveAttribute('aria-pressed', 'false');
    await photo.click();
    await expect(photo).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Mapa', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('pusta lista na ekranie analizy odsyła do mapy', async ({ page }) => {
    await page.goto('/analiza');
    await page.getByRole('link', { name: 'Wróć do mapy' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('arkusz od dołu: zwinięty pokazuje pole i akcję, rozwija się, strona się nie przewija', async ({
      page,
    }) => {
      await page.goto('/');

      const panel = page.getByTestId('parcels-panel');
      const search = page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' });

      await expect(panel).toHaveAttribute('data-snap', 'peek');
      await expect(search).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Analizuj działkę' })).toBeInViewport();

      await page.getByRole('button', { name: 'Rozwiń panel' }).click();
      await expect(panel).toHaveAttribute('data-snap', 'half');
      await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeInViewport();

      // pole 16 px: iOS nie przybliza strony przy fokusie; brak poziomego przewijania
      await expect(search).toHaveCSS('font-size', '16px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      await expectTouchTargets(panel.getByRole('button'));
      await expectTouchTargets(page.getByRole('group', { name: 'Podkład mapy' }).getByRole('button'));
    });
  });
});
