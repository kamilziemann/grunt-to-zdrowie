// Strona "Jak liczymy": wejscie ze stopki i z raportu, zrodla z licencja i linkiem, cache, telefon. Wersje
// angielska sprawdza test komponentu (jezyk `en` jest w aplikacji wylaczony - lib/locale ENABLED_LOCALES).
import { LOW_CONFIDENCE_REPORT_URL, mockAnalysisApi } from './support/analysis-api';

import { expect, test } from './support/test';

test('stopka prowadzi do „Jak liczymy”: ocena, czego nie wiemy, źródła z licencją', async ({ page }) => {
  await page.goto('/analiza');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Jak liczymy' }).click();

  await expect(page).toHaveURL(/\/jak-liczymy$/);
  await expect(page).toHaveTitle(/Jak liczymy/);
  await expect(page.getByRole('heading', { level: 1, name: 'Jak liczymy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Czego nie wiemy' })).toBeVisible();
  await expect(page.getByText('Pogoda pochodzi z siatki o oczkach około 50 km.')).toBeVisible();

  const sources = page.getByTestId('method-sources').getByRole('listitem');

  await expect(sources).toHaveCount(9);
  await expect(sources.filter({ hasText: 'NASA POWER' })).toContainText('CC BY 4.0');
  await expect(
    sources.filter({ hasText: 'BDOT10k' }).getByRole('link', { name: /Strona źródła/ }),
  ).toHaveAttribute('href', /geoportal\.gov\.pl\/pl\/dane\//);
});

test('raport linkuje do metodyki w sekcji źródeł', async ({ page }) => {
  await mockAnalysisApi(page);
  await page.goto(LOW_CONFIDENCE_REPORT_URL);
  await page.getByTestId('method-link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Jak liczymy' })).toBeVisible();
});

test('strona statyczna z cache brzegowym', async ({ page }) => {
  const response = await page.goto('/jak-liczymy');

  expect(response?.headers()['cache-control']).toMatch(/public/);
});

test('na telefonie bez przewijania w poziomie', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/jak-liczymy');
  await expect(page.getByRole('heading', { level: 1, name: 'Jak liczymy' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
