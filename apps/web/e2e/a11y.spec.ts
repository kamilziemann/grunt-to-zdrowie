// Dostepnosc: axe z regulami WCAG 2.x A i AA na kluczowych stronach, w jasnym i ciemnym motywie (emulacja
// prefers-color-scheme; bez ciasteczka motyw wynika z systemu). Naruszenie = blad testu; regul nie wylaczamy.
// Nowa strona = nowa pozycja w PAGES. Dzialka i raport sa podstawione (bez ULDK i zrodel danych).
import { mockAnalysisApi, PARCEL_ID, REPORT_URL } from './support/analysis-api';
import { expectHeadingOrder, expectNoViolations } from './support/axe';

import { expect, test } from './support/test';

const SCHEMES = ['light', 'dark'] as const;
const PAGES = [
  ['strona główna (mapa działek)', '/', 'Znajdź działkę'],
  ['działki do analizy (pusta lista)', '/analiza', 'Nie wybrano żadnej działki'],
  ['formularz analizy (uprawa i dzień)', `/analiza?dzialki=${PARCEL_ID}`, 'Działki do analizy'],
  ['raport wodny', REPORT_URL, 'Raport wodny pola'],
  ['raport bez parametrów', '/raport', 'Brakuje danych do raportu'],
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
        await mockAnalysisApi(page);
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        // raport sprawdzamy w pelnej postaci (nie w stanie postepu)
        if (path === REPORT_URL) await expect(page.getByTestId('verdict')).toBeVisible();
        await expectNoViolations(page);
        await expectHeadingOrder(page);
      });
    }
  });
}
