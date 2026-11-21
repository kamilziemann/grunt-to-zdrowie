// Dostepnosc: axe z regulami WCAG 2.x A i AA na kluczowych stronach, w jasnym i ciemnym motywie (emulacja
// prefers-color-scheme; bez ciasteczka motyw wynika z systemu). Naruszenie = blad testu; regul nie wylaczamy.
// Nowa strona = nowa pozycja w PAGES.
import { expectHeadingOrder, expectNoViolations } from './support/axe';

import { expect, test } from './support/test';

const SCHEMES = ['light', 'dark'] as const;
const PAGES = [
  ['strona główna (mapa działek)', '/', 'Znajdź działkę'],
  ['działki do analizy (pusta lista)', '/analiza', 'Nie wybrano żadnej działki'],
  ['katalog /design', '/design', 'Design system'],
  // Domyslna konfiguracja e2e ma auth wylaczony: strony auth pokazuja komunikat (formularze: auth-enabled.spec.ts).
  ['logowanie (auth wyłączone)', '/sign-in', 'Logowanie'],
  ['rejestracja (auth wyłączone)', '/sign-up', 'Rejestracja'],
  ['konto (auth wyłączone)', '/account', 'Konto'],
  ['404 (nieznany adres)', '/nie-ma-takiej-strony', 'Nie ma takiej strony'],
] as const;

for (const colorScheme of SCHEMES) {
  test.describe(`a11y (${colorScheme})`, () => {
    test.use({ colorScheme });

    for (const [name, path, heading] of PAGES) {
      test(name, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expectNoViolations(page);
        await expectHeadingOrder(page);
      });
    }
  });
}
