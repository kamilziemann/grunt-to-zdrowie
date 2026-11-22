import { expectNoViolations } from './support/axe';
import { EN_DISABLED, EN_ENABLED } from './support/locale-path';
import { expect, hydratingPage, test } from './support/test';

// Preferencje uzytkownika: jezyk w adresie (`/` = polski, `/en/...` = angielski - ten sam HTML dla wszystkich, wiec
// moze byc w cache brzegu). Motywu nie wybiera sie - jest tylko jasny (ADR 0012, sprawdza go a11y.spec.ts).
test.describe('preferencje', () => {
  test('przełącznik języka prowadzi na angielską wersję strony, która zostaje po przeładowaniu', async ({
    page,
  }) => {
    test.skip(!EN_ENABLED, EN_DISABLED);
    await page.goto('/analiza');
    await expect(page.getByRole('heading', { level: 1, name: 'Nie wybrano żadnej działki' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

    await page.getByRole('link', { name: 'EN - zmień język na English' }).click();

    await expect(page).toHaveURL(/\/en\/analiza$/);
    await expect(page.getByRole('heading', { level: 1, name: 'No parcel selected' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'No parcel selected' })).toBeVisible();
  });

  test('tylko polski: /en/... przekierowuje na polski adres, przełącznika języka nie ma', async ({
    page,
  }) => {
    test.skip(EN_ENABLED, 'angielski wlaczony - przelacznik i /en sprawdzaja testy wyzej');

    await page.goto('/en/analiza');
    await expect(page).toHaveURL(/\/analiza$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.getByRole('heading', { level: 1, name: 'Nie wybrano żadnej działki' })).toBeVisible();
    await expect(page.getByRole('link', { name: /zmień język/ })).toHaveCount(0);

    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Język' })).toHaveCount(0);
  });

  test('adres bez prefiksu jest po polsku, nawet gdy przeglądarka prosi o angielski', async ({ browser }) => {
    test.skip(!EN_ENABLED, EN_DISABLED);
    const context = await browser.newContext({
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const page = hydratingPage(await context.newPage());

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expectNoViolations(page);
    await context.close();
  });
});
