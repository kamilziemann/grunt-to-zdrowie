// Strona glowna: pole numeru dzialki na pierwszym ekranie i stany wyszukiwania (kilka trafien, brak dzialki, adres,
// GUGiK nie odpowiada). Bez uslug zewnetrznych: odpowiedzi /api/parcels/search i /api/places/search sa podstawione.
import type { Page } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { expectNoZoomFont } from './support/font-size';
import { mockMapServices } from './support/map-services';
import { expect, test } from './support/test';
import { expectTouchTargets } from './support/touch-targets';

const CANDIDATES = {
  total: 2,
  items: [
    {
      id: '020803_2.0001.12',
      number: '12',
      region: 'Dąbrowa',
      commune: 'Wilków',
      county: 'opolski',
      voivodeship: 'opolskie',
    },
    {
      id: '300902_2.0004.12',
      number: '12',
      region: 'Dąbrowa',
      commune: 'Kłodawa',
      county: 'kolski',
      voivodeship: 'wielkopolskie',
    },
  ],
};

const PLACE = {
  id: 'osm-1',
  label: 'Chwalim',
  detail: 'gm. Kargowa, zielonogórski, lubuskie',
  center: [15.85, 52.08],
  bbox: [15.84, 52.07, 15.86, 52.09],
};

async function mockSearch(
  page: Page,
  { parcels, places = [], status = 200 }: { parcels?: unknown; places?: unknown[]; status?: number },
) {
  await page.route('**/api/parcels/search**', (route) =>
    status === 200
      ? route.fulfill({ json: parcels })
      : route.fulfill({
          status,
          contentType: 'application/problem+json',
          json: { type: 'about:blank', title: 'Upstream failed', status, code: 'UPSTREAM_FAILED' },
        }),
  );
  await page.route('**/api/places/search**', (route) => route.fulfill({ json: { items: places } }));
}

async function searchFor(page: Page, text: string) {
  await page.getByRole('searchbox', { name: 'Numer działki albo nazwa wsi i numer' }).fill(text);
  await page.getByRole('button', { name: 'Sprawdź działkę' }).first().click();
}

test.describe('strona główna', () => {
  test('pierwszy ekran: pole numeru, mapa bez numeru, obietnice i podpowiedź', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Ocena suszy dla działki rolnej' }),
    ).toBeVisible();
    await expect(
      page.getByRole('searchbox', { name: 'Numer działki albo nazwa wsi i numer' }),
    ).toBeInViewport();
    await expect(page.getByRole('link', { name: /Nie znam numeru/ })).toHaveAttribute('href', '/mapa');
    await expect(page.getByText('Bez zakładania konta')).toBeVisible();

    await page.getByText('Gdzie znajdę numer działki?').click();
    await expect(page.getByText(/wypisie z rejestru gruntów/).first()).toBeVisible();
  });

  test('za krótki tekst pokazuje podpowiedź zamiast wysyłać zapytanie', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/parcels')) requests.push(request.url());
    });

    await page.goto('/');
    await searchFor(page, '12');

    await expect(page.getByRole('alert').filter({ hasText: 'Wpisz co najmniej 3 znaki' })).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('pełny numer prowadzi prosto do kroku „Czy to Twoja działka?”', async ({ page }) => {
    await page.route('**/api/parcels/by-id**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.goto('/');
    await searchFor(page, '080904_5.0001.349/1');

    await expect(page).toHaveURL(/\/analiza\?dzialki=080904_5\.0001\.349%2F1$/);
  });

  test('kilka trafień: lista z gminą i powiatem, wybór prowadzi do działki', async ({ page }) => {
    await mockSearch(page, { parcels: CANDIDATES });
    await page.route('**/api/parcels/by-id**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.goto('/');
    await searchFor(page, 'Dąbrowa 12');

    const list = page.getByTestId('parcel-candidates');

    await expect(list.getByRole('button')).toHaveCount(2);
    await list.getByRole('button', { name: /Kłodawa/ }).click();
    await expect(page).toHaveURL(/\/analiza\?dzialki=300902_2\.0004\.12$/);
  });

  test('brak działki: komunikat z poprawą numeru i mapą', async ({ page }) => {
    await mockSearch(page, { parcels: { total: 0, items: [] } });
    await page.goto('/');
    await searchFor(page, 'Dąbrowa 999');

    const state = page.getByTestId('home-search-state');

    await expect(state.getByRole('heading', { name: 'Nie znaleźliśmy działki o tym numerze' })).toBeVisible();
    await state.getByRole('button', { name: 'Popraw numer' }).click();
    await expect(page.getByRole('searchbox', { name: 'Numer działki albo nazwa wsi i numer' })).toBeFocused();
    await expect(state.getByRole('link', { name: 'Wskaż działkę na mapie' })).toHaveAttribute(
      'href',
      '/mapa',
    );
  });

  test('GUGiK nie odpowiada: spróbuj ponownie albo wskaż na mapie', async ({ page }) => {
    await mockSearch(page, { status: 502 });
    await page.goto('/');
    await searchFor(page, 'Dąbrowa 12');

    const state = page.getByTestId('home-search-state');

    await expect(state.getByRole('heading', { name: 'Nie możemy teraz pobrać działek' })).toBeVisible();
    await expect(state.getByRole('button', { name: 'Spróbuj ponownie' })).toBeVisible();
    await expect(state.getByRole('link', { name: 'Wskaż działkę na mapie' })).toBeVisible();
  });

  test('adres: wybór miejsca otwiera mapę w tej okolicy', async ({ page }) => {
    await mockSearch(page, { parcels: { total: 0, items: [] }, places: [PLACE] });
    await mockMapServices(page);
    await page.goto('/');
    await searchFor(page, 'Chwalim');

    await page
      .getByTestId('place-results')
      .getByRole('button', { name: /Chwalim/ })
      .click();
    await expect(page).toHaveURL(/\/mapa\?widok=15\.840000%2C52\.070000%2C15\.860000%2C52\.090000$/);
    await expect(page.getByText('Kliknij swoją działkę na mapie.')).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('pole i przycisk na pierwszym ekranie, duże cele, bez poziomego przewijania, axe', async ({
      page,
    }) => {
      await page.goto('/');

      const field = page.getByRole('searchbox', { name: 'Numer działki albo nazwa wsi i numer' });

      await expect(field).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Sprawdź działkę' }).first()).toBeInViewport();
      await expectNoZoomFont(field);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      await expectTouchTargets(page.getByRole('main').getByRole('button'));
      await expectNoViolations(page);
    });
  });
});
