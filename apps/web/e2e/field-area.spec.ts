import { expect, test } from './support/test';
import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { expectTouchTargets } from './support/touch-targets';

// Wlasne pole (D3): tryb rysowania na mapie i analiza obszaru z adresu. Podklad mapy to usluga zewnetrzna, wiec
// stukanie w mape (punkty, podzial linia) sprawdzaja testy jednostkowe geometrii i trybu oraz przeglad reczny;
// tu: panel trybu, przejscie obszaru z adresu przez formularz do zadania analizy (geometria w POST).
const SQUARE = 'g54jEo5t-JmDsDREpBBvBA';

test.describe('własne pole', () => {
  test('tryb rysowania: panel, podział wymaga jednej działki, analiza zablokowana do zamknięcia obszaru', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Podziel działkę linią' })).toBeDisabled();
    await page.getByRole('button', { name: 'Narysuj własne pole' }).click();

    const panel = page.getByTestId('field-draw');

    await expect(panel.getByRole('heading', { level: 1, name: 'Własne pole' })).toBeVisible();
    await expect(page.getByTestId('field-area')).toHaveText('Brak punktów');
    await expect(panel.getByRole('radio', { name: 'Podziel działkę' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Analizuj ten obszar' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cofnij punkt' })).toBeDisabled();
    await expectNoViolations(page);

    await panel.getByRole('button', { name: 'Wróć do listy działek' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Znajdź działkę' })).toBeVisible();
  });

  test('obszar z adresu: podsumowanie, formularz i zapytanie z geometrią zamiast całej działki', async ({
    page,
  }) => {
    await mockAnalysisApi(page);

    const body = page.waitForRequest((request) => request.url().endsWith('/api/analysis'));

    await page.goto(`/analiza?dzialki=${PARCEL_ID}&obszar=${SQUARE}&rodzaj=part`);
    await expect(page.getByTestId('own-area')).toContainText('Część działki 6509');
    await page.locator('label[data-crop="winter_wheat"]').click();
    await page.getByRole('button', { name: 'Analizuj' }).click();

    await expect(page).toHaveURL(new RegExp(`obszar=${SQUARE}&rodzaj=part&uprawa=winter_wheat`));

    const request = JSON.parse((await body).postData() ?? '{}') as {
      field: { kind?: string; parcelIds?: string[]; label?: string; geometry?: { type: string } };
    };

    expect(request.field).toMatchObject({
      kind: 'part',
      parcelIds: [PARCEL_ID],
      label: 'Część działki 6509',
      geometry: { type: 'Polygon' },
    });
    await expect(page.getByTestId('short-analysis')).toBeVisible();
  });

  test('uszkodzony obszar w linku raportu prosi o ponowny wybór', async ({ page }) => {
    await page.goto(`/raport?obszar=%21%21&uprawa=winter_wheat&data=2026-06-15`);

    await expect(page.getByRole('heading', { level: 1, name: 'Brakuje danych do raportu' })).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('pasek trybu: cofnij i analizuj zawsze widoczne, duże cele, bez poziomego przewijania', async ({
      page,
    }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Narysuj własne pole' }).click();

      await expect(page.getByRole('button', { name: 'Analizuj ten obszar' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Cofnij punkt' })).toBeInViewport();
      await expectTouchTargets(
        page
          .getByTestId('field-draw')
          .getByRole('button')
          .or(page.getByRole('button', { name: /Cofnij punkt|Analizuj ten obszar/ })),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });
});
