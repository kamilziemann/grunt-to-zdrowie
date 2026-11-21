import { expect, test } from './support/test';
import { mockAnalysisApi, PARCEL_ID, REPORT_URL } from './support/analysis-api';
import { expectTouchTargets } from './support/touch-targets';

// Formularz analizy i raport. Dzialka i raport sa podstawione (`mockAnalysisApi`): API pobiera je z ULDK i
// zrodel danych, a e2e nie wola uslug zewnetrznych. Prawdziwy przeplyw jest sprawdzany recznie.
const SECTIONS = [
  /1\.\s*Ocena/,
  /2\.\s*Ostatnie 10 sezonów/,
  /3\.\s*Dlaczego brakuje wody/,
  /4\.\s*Jak zatrzymać wodę na polu/,
  /5\.\s*Uprawa, która oszczędza wodę/,
  /6\.\s*Nawadnianie/,
  /7\.\s*Skąd są dane i na ile im ufać/,
];

test.describe('analiza i raport', () => {
  test('od działki do raportu: uprawa, dziś, Analizuj; raport przeżywa odświeżenie', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(`/analiza?dzialki=${PARCEL_ID}`);

    await expect(page.getByText('Działka 6509')).toBeVisible();
    await page.getByRole('button', { name: 'Analizuj' }).click();
    await expect(page.getByText('Wybierz uprawę, żeby przejść dalej.')).toBeVisible();

    // rolnik klika cala karte uprawy (natywne radio jest ukryte wizualnie)
    await page.locator('label[data-crop="winter_wheat"]').click();
    await expect(page.getByRole('radio', { name: /Zboża ozime/ })).toBeChecked();
    await page.getByRole('button', { name: 'Analizuj' }).click();

    await expect(page).toHaveURL(
      new RegExp(
        `/raport\\?dzialki=${PARCEL_ID.replace('.', '\\.')}&uprawa=winter_wheat&data=\\d{4}-\\d{2}-\\d{2}$`,
      ),
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Raport wodny pola' })).toBeVisible();
    await expect(page.getByTestId('verdict')).toContainText('Ryzyko suszy');
    await expect(page.getByTestId('sample-banner')).toContainText('nie podejmuj na ich podstawie decyzji');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(SECTIONS);

    await page.reload();
    await expect(page.getByTestId('verdict')).toBeVisible();
  });

  test('brak danych źródła i ograniczenia są nazwane wprost', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(REPORT_URL);

    await expect(page.locator('[data-source="forecast"]')).toContainText('Brak danych');
    await expect(page.locator('[data-limitation="sample_data"]')).toBeVisible();
  });

  test('błąd analizy pokazuje komunikat i ponawia zapytanie', async ({ page }) => {
    await mockAnalysisApi(page, { analysisStatus: 502 });
    await page.goto(REPORT_URL);

    await expect(page.getByText('Nie udało się przygotować raportu')).toBeVisible();
    await page.unroute('**/api/analysis');
    await mockAnalysisApi(page);
    await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
    await expect(page.getByTestId('verdict')).toBeVisible();
  });

  test('link bez uprawy i daty prowadzi z powrotem do formularza', async ({ page }) => {
    await page.goto(`/raport?dzialki=${PARCEL_ID}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Brakuje danych do raportu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wybierz uprawę i datę' })).toHaveAttribute(
      'href',
      `/analiza?dzialki=${PARCEL_ID}`,
    );
  });

  test('wydruk: bez nawigacji i przycisków, szczegóły dla doradcy rozwinięte', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(REPORT_URL);
    await expect(page.getByTestId('verdict')).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByRole('button', { name: 'Drukuj / zapisz PDF' })).toBeHidden();
    await expect(page.locator('header').filter({ has: page.getByRole('navigation') })).toBeHidden();
    await expect(page.getByText(/Klimatyczny bilans wodny/)).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('formularz: przycisk zawsze widoczny, duże cele dotykowe, pole daty 16 px, bez poziomego przewijania', async ({
      page,
    }) => {
      await mockAnalysisApi(page);
      await page.goto(`/analiza?dzialki=${PARCEL_ID}`);

      const submit = page.getByRole('button', { name: 'Analizuj' });

      await expect(submit).toBeInViewport();
      await page.getByRole('radio', { name: /Łąka lub pastwisko/ }).scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await expect(page.getByLabel('Dzień analizy')).toHaveCSS('font-size', '16px');
      await expectTouchTargets(page.getByTestId('analysis-form').locator('label:has(input[type="radio"])'));
      await expectTouchTargets(page.getByTestId('analysis-form').getByRole('button'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });

    test('raport mieści się na szerokość telefonu', async ({ page }) => {
      await mockAnalysisApi(page);
      await page.goto(REPORT_URL);
      await expect(page.getByTestId('verdict')).toBeVisible();

      await expectTouchTargets(page.getByTestId('report-header').getByRole('button'));
      await expectTouchTargets(page.getByTestId('report-header').getByRole('link'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });
  });
});
