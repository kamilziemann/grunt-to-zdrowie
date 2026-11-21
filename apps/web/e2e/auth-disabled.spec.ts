import { API_URL } from './support/api-state';
import { expect, test } from './support/test';

// Domyslna konfiguracja (AUTH_ENABLED=false w API): aplikacja dziala bez kont, a strony auth mowia o tym wprost.

test.describe('auth wyłączone (domyślnie)', () => {
  test('nawigacja nie ma logowania, a strony działają bez sesji', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Nawigacja główna' });

    await expect(nav.getByRole('link', { name: 'Grunt to Zdrowie' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Zaloguj się' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Wyloguj się' })).toHaveCount(0);

    await page.goto('/analiza');
    await expect(page.getByRole('heading', { level: 1, name: 'Nie wybrano żadnej działki' })).toBeVisible();
  });

  test('strony logowania i rejestracji pokazują stan „logowanie wyłączone” zamiast formularza', async ({
    page,
  }) => {
    for (const path of ['/sign-in', '/sign-up']) {
      await page.goto(path);
      await expect(page.getByText('Logowanie jest wyłączone')).toBeVisible();
      await expect(page.getByLabel('Hasło')).toHaveCount(0);
    }
  });

  test('/account (grupa chroniona) renderuje się normalnie, bez przekierowania', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText('Logowanie jest wyłączone')).toBeVisible();
  });

  test('API: /me mówi authEnabled=false, a proxy auth zwraca 503 not_configured', async ({
    page,
    request,
  }) => {
    const me = await request.get(`${API_URL}/me`);

    expect(await me.json()).toEqual({ authEnabled: false, authenticated: false, user: null });

    const proxied = await page.request.get('/api/auth/get-session');

    expect(proxied.status()).toBe(503);
    expect(await proxied.json()).toMatchObject({ code: 'not_configured' });
  });
});
