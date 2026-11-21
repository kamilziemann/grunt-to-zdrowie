import { type Page } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { expect, test } from './support/test';

// Projekt `auth` (playwright.config.ts): osobny serwer z AUTH_ENABLED=true + AUTH_SECRET, wlasna D1.
// Ciasteczko sesji jest first-party na originie stron (proxy /api/auth), wiec caly przeplyw idzie przez przegladarke.
const PASSWORD = 'Haslo-E2E-12345';

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

// Konto (UserMenu) jest w naglowku aplikacji.
const nav = (page: Page) => page.getByRole('banner');

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up');
  await page.getByLabel('Imię').fill('Ala E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe('auth włączone', () => {
  test('rejestracja → e-mail w nagłówku i na koncie → wylogowanie → /account kieruje na logowanie', async ({
    page,
  }) => {
    const email = uniqueEmail('flow');

    await page.goto('/account');
    // strona chroniona bez sesji: logowanie z powrotem na nia (`next`)
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    await expect(nav(page).getByRole('link', { name: 'Zaloguj się' })).toBeVisible();

    await signUp(page, email);
    await expect(page.getByTestId('account-email')).toHaveText(email);
    await expect(nav(page).getByRole('link', { name: email })).toBeVisible();

    await nav(page).getByRole('button', { name: 'Wyloguj się' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(nav(page).getByRole('link', { name: 'Zaloguj się' })).toBeVisible();

    await page.goto('/account');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
  });

  test('logowanie istniejącego konta; złe hasło pokazuje komunikat', async ({ page }) => {
    const email = uniqueEmail('login');

    await signUp(page, email);
    await nav(page).getByRole('button', { name: 'Wyloguj się' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    // Pusty formularz: fokus na pierwszym blednym polu.
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page.getByLabel('E-mail')).toBeFocused();

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Hasło').fill('zle-haslo-12345');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();

    await page.getByLabel('Hasło').fill(PASSWORD);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(nav(page).getByRole('link', { name: email })).toBeVisible();
  });

  test('strona chroniona bez sesji → logowanie → powrót na tę stronę', async ({ page }) => {
    const email = uniqueEmail('next');

    await signUp(page, email);
    await nav(page).getByRole('button', { name: 'Wyloguj się' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto('/account?tab=x');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%3Ftab%3Dx$/);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Hasło').fill(PASSWORD);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page).toHaveURL(/\/account\?tab=x$/);
  });

  test('strony działek pozostają publiczne bez sesji', async ({ page }) => {
    await page.goto('/analiza');
    await expect(page.getByRole('heading', { level: 1, name: 'Nie wybrano żadnej działki' })).toBeVisible();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`a11y (${colorScheme})`, () => {
      test.use({ colorScheme });

      test('formularze logowania i rejestracji oraz konto', async ({ page }) => {
        await page.goto('/sign-in');
        await expect(page.getByRole('heading', { level: 1, name: 'Logowanie' })).toBeVisible();
        await expect(page.getByLabel('Hasło')).toBeVisible();
        await expectNoViolations(page);

        await page.goto('/sign-up');
        await expect(page.getByRole('heading', { level: 1, name: 'Rejestracja' })).toBeVisible();
        await expectNoViolations(page);

        await signUp(page, uniqueEmail(`a11y-${colorScheme}`));
        await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
        await expectNoViolations(page);
      });
    });
  }
});
