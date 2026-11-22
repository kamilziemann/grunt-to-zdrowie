// Powloka aplikacji bez kont (ADR 0011): naglowek ma tylko logo, jezyk i motyw, a dawne adresy kont to 404.
import { API_URL } from './support/api-state';
import { expect, test } from './support/test';

test('nagłówek nie ma elementów konta', async ({ page }) => {
  await page.goto('/jak-liczymy');

  const nav = page.getByRole('navigation', { name: 'Nawigacja główna' });

  await expect(nav.getByRole('link', { name: /^Grunt to Zdrowie/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Zaloguj|Załóż konto/ })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: /Wyloguj|Konto/ })).toHaveCount(0);
});

for (const path of ['/sign-in', '/sign-up', '/account']) {
  test(`${path} to 404`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Nie ma takiej strony' })).toBeVisible();
  });
}

test('API nie ma tras kont', async ({ request }) => {
  for (const path of ['/me', '/auth/get-session']) {
    const response = await request.get(`${API_URL}${path}`);

    expect(response.status()).toBe(404);
  }
});
