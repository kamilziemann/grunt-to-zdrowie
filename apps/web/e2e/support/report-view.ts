// Raport ma dwa poziomy: prosty (domyslny) i szczegolowy (`widok=szczegoly`, pelna analiza). Na telefonie sekcje
// pelnej analizy startuja zwiniete - testy tresci sekcji rozwijaja je jak rolnik (klik w naglowek).
import type { Page } from '@playwright/test';

/** Ten sam adres raportu w widoku szczegolowym. */
export function detailed(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}widok=szczegoly`;
}

/** Rozwija wszystkie zwiniete sekcje pelnej analizy. */
export async function openSections(page: Page) {
  await page.getByTestId('report-details').waitFor();

  const closed = page.locator('[data-report-section] > details:not([open]) > summary');

  // lokator jest leniwy: po kazdym kliknieciu zwinietych sekcji ubywa, wiec zawsze klikamy pierwsza
  while ((await closed.count()) > 0) await closed.first().click();
}
