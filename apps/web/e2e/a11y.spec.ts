// Dostepnosc: axe z regulami WCAG 2.x A i AA na kluczowych stronach. Aplikacja ma tylko jasny motyw (ADR 0012), a
// przebieg idzie przy systemie w trybie ciemnym (`colorScheme: 'dark'`) - strona ma zostac jasna, a ciemny panel
// na ekranach, ktore go maja (`/analiza`, `/mapa`, przyklad wyniku na stronie glownej), tez trafia pod axe.
// Naruszenie = blad testu; regul nie wylaczamy.
// Nowa strona = nowa pozycja w PAGES. Dzialka i raport sa podstawione (bez ULDK i zrodel danych), podklad mapy
// i kafle hydrografii tez: z prawdziwym podkladem (OpenFreeMap) axe ruszal czasem w polowie ladowania mapy, gdy
// MapLibre jeszcze przebudowywal DOM - wynik zalezal od sieci. Mape sprawdzamy w stanie koncowym (`ready`).
import { AUTUMN_REPORT } from '../src/features/report/fixtures/autumn-report';
import { FIELD_REPORT } from '../src/features/report/fixtures/field-report';
import { WEATHER_REPORT } from '../src/features/report/fixtures/weather-report';
import {
  DROUGHT_REPORT_URL,
  LOW_CONFIDENCE_REPORT_URL,
  mockAnalysisApi,
  mockReport,
  PARCEL_ID,
  REPORT_URL,
  reportUrl,
} from './support/analysis-api';
import { expectHeadingOrder, expectNoViolations } from './support/axe';
import { mockBasemap, mockHydroApi } from './support/hydro-api';

import { expect, test } from './support/test';

const PAGES = [
  ['strona główna', '/', 'Ocena suszy dla działki rolnej'],
  ['mapa działek', '/mapa', 'Znajdź działkę'],
  ['działki do analizy (pusta lista)', '/analiza', 'Nie wybrano żadnej działki'],
  ['formularz analizy (uprawa i dzień)', `/analiza?dzialki=${PARCEL_ID}`, 'Czy to Twoja działka?'],
  [
    'formularz analizy własnego obszaru',
    `/analiza?dzialki=${PARCEL_ID}&obszar=g54jEo5t-JmDsDREpBBvBA&rodzaj=part`,
    'Twoje pole',
  ],
  ['raport wodny', REPORT_URL, 'Raport wodny pola'],
  ['raport wodny – szczegóły rozwinięte', `${REPORT_URL}&widok=szczegoly`, 'Raport wodny pola'],
  [
    'raport z prawdziwego silnika (kalendarz suszy, części przykładowe)',
    DROUGHT_REPORT_URL,
    'Raport wodny pola',
  ],
  ['raport z zastrzeżeniem (niska pewność, jedna atrapa)', LOW_CONFIDENCE_REPORT_URL, 'Raport wodny pola'],
  ['raport bez parametrów', '/raport', 'Brakuje danych do raportu'],
  ['gospodarstwo bez parametrów', '/gospodarstwo', 'Brakuje danych do raportu'],
  ['jak liczymy (metodyka i źródła)', '/jak-liczymy', 'Jak liczymy'],
  ['katalog /design', '/design', 'Design system'],
  ['404 (nieznany adres)', '/nie-ma-takiej-strony', 'Nie ma takiej strony'],
] as const;

test.describe('a11y', () => {
  test.use({ colorScheme: 'dark' });

  test('przy systemie w trybie ciemnym strona zostaje jasna', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(scheme).toBe('light');
    expect(background).toBe('rgb(255, 255, 255)');
  });

  for (const [name, path, heading] of PAGES) {
    test(name, async ({ page }) => {
      await mockAnalysisApi(page);
      await mockBasemap(page);
      await mockHydroApi(page, { tiles: {} });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      // mapa dzialek: axe dopiero po zaladowaniu stylu i warstw (przedtem MapLibre dopisuje kontrolki i podpisy)
      for (const map of await page.getByTestId('parcel-map').all()) {
        await expect(map).toHaveAttribute('data-map-state', 'ready');
      }

      // raport sprawdzamy w pelnej postaci (nie w stanie postepu); szczegoly rozwiniete - z oceną w pelnej analizie
      if (path.startsWith('/raport?')) await expect(page.getByTestId('short-analysis')).toBeVisible();

      if (path.includes('widok=szczegoly')) await expect(page.getByTestId('verdict')).toBeVisible();
      await expectNoViolations(page);
      await expectHeadingOrder(page);
    });
  }

  test('raport z miejscami na polu (szkic ze strefami, wyróżnione miejsce)', async ({ page }) => {
    await mockReport(page, FIELD_REPORT);
    await mockBasemap(page);
    await mockHydroApi(page, { tiles: {} });
    await page.goto(`${reportUrl(FIELD_REPORT)}&widok=szczegoly`);
    await expect(page.getByTestId('zone-list')).toBeVisible();
    await page.getByTestId('zone-list').getByRole('button').first().focus();
    await expectNoViolations(page);
    await expectHeadingOrder(page);
  });

  for (const [name, report] of [
    ['pogodynka: susza z zbiornikiem, rachunkiem wody i satelitą (0.8.0)', WEATHER_REPORT],
    ['pogodynka: poza sezonem z prognozą (0.8.0)', AUTUMN_REPORT],
  ] as const) {
    for (const widok of ['', '&widok=szczegoly']) {
      test(`${name}${widok ? ' – szczegóły rozwinięte' : ''}`, async ({ page }) => {
        await mockReport(page, report);
        await mockBasemap(page);
        await mockHydroApi(page, { tiles: {} });
        await page.goto(`${reportUrl(report)}${widok}`);
        await expect(page.getByTestId('short-analysis')).toBeVisible();
        await expectNoViolations(page);
        await expectHeadingOrder(page);
      });
    }
  }
});
