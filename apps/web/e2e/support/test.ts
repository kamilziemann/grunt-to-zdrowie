// `test` i `expect` dla specow: `page.goto`/`page.reload` czekaja, az strona aplikacji sie zhydratuje (`<html
// data-hydrated>` z __root). W `vite dev` hydracja trwa chwile - klikniecie przed nia trafia w natywny formularz albo
// link zamiast w handler Reacta, a test zawodzi losowo. Odpowiedzi nie-HTML (API, pliki) nie czekaja.
import { expect, test as base, type Page, type Response } from '@playwright/test';

/** Czeka na hydracje po nawigacji, jesli odpowiedz to strona HTML. */
export async function waitForHydration(page: Page, response: Response | null): Promise<void> {
  if (!response?.headers()['content-type']?.includes('text/html')) return;

  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/** Strona z nawigacja czekajaca na hydracje (takze dla stron z `browser.newContext()`). */
export function hydratingPage(page: Page): Page {
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);

  page.goto = async (url, options) => {
    const response = await goto(url, options);

    await waitForHydration(page, response);

    return response;
  };
  page.reload = async (options) => {
    const response = await reload(options);

    await waitForHydration(page, response);

    return response;
  };

  return page;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(hydratingPage(page));
  },
});

export { expect };
