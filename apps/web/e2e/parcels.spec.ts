import { mockAnalysisApi } from './support/analysis-api';
import { expectTouchTargets } from './support/touch-targets';
import { expect, test } from './support/test';

// Ekran wyboru dzialek. Testy nie wolaja ULDK (zewnetrzna usluga GUGiK): sprawdzaja uklad, walidacje pola i przejscia,
// ktore nie potrzebuja danych dzialki. Przeplyw z prawdziwa dzialka jest sprawdzany recznie (docs/plans).
test.describe('działki', () => {
  test('pokazuje wyszukiwarkę, kroki i zablokowany następny krok', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
    // pierwsze wejscie: trzy kroki i przyklad zamiast paska etapow
    const firstSteps = page.getByTestId('first-steps');

    await expect(firstSteps.getByRole('listitem')).toHaveText([
      /Znajdź działkę/,
      /Wybierz uprawę i dzień/,
      /Przeczytaj raport/,
    ]);
    await expect(firstSteps.getByRole('link', { name: /Zobacz przykład/ })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Etapy' })).toBeHidden();
    await expect(page.getByRole('application', { name: /Mapa/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analizuj działkę' })).toBeDisabled();
    await expect(page.getByText('Nie masz jeszcze żadnej działki')).toBeVisible();
  });

  test('„Zobacz przykład” prowadzi do gotowego raportu (działka i uprawa w adresie)', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto('/');
    await page.getByRole('link', { name: /Zobacz przykład/ }).click();

    await expect(page).toHaveURL(/\/raport\?dzialki=221002_5\.0015\.120&uprawa=winter_wheat&data=2018-07-15/);
    await expect(page.getByTestId('verdict')).toBeVisible();
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

    test('arkusz od dołu: pierwsze wejście do połowy z przykładem, rozwija się, strona się nie przewija', async ({
      page,
    }) => {
      await page.goto('/');

      const panel = page.getByTestId('parcels-panel');
      const search = page.getByRole('searchbox', { name: 'Numer działki, obręb z numerem albo adres' });

      // pierwsze wejscie: arkusz do polowy, "Zobacz przyklad" widoczny bez przewijania
      await expect(panel).toHaveAttribute('data-snap', 'half');
      await expect(search).toBeInViewport();
      await expect(page.getByRole('link', { name: /Zobacz przykład/ })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Analizuj działkę' })).toBeInViewport();
      await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeInViewport();

      await page.getByRole('button', { name: 'Rozwiń panel' }).click();
      await expect(panel).toHaveAttribute('data-snap', 'full');

      // pole 16 px: iOS nie przybliza strony przy fokusie; brak poziomego przewijania
      await expect(search).toHaveCSS('font-size', '16px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      await expectTouchTargets(panel.getByRole('button'));
      await expectTouchTargets(page.getByRole('group', { name: 'Podkład mapy' }).getByRole('button'));
    });
  });
});
