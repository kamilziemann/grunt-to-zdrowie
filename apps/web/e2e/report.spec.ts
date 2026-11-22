import { LOW_CONFIDENCE_REPORT } from '../src/features/report/fixtures/low-confidence-report';
import { expect, test } from './support/test';
import {
  DROUGHT_REPORT_URL,
  LOW_CONFIDENCE_REPORT_URL,
  mockAnalysisApi,
  PARCEL_ID,
  REPORT_URL,
} from './support/analysis-api';
import { DITCH_THROUGH_TILES, mockBasemap, mockHydroApi } from './support/hydro-api';
import { detailed, openSections } from './support/report-view';
import { expectTouchTargets } from './support/touch-targets';
import { expectNoZoomFont } from './support/font-size';

// Formularz analizy i raport. Dzialka i raport sa podstawione (`mockAnalysisApi`): API pobiera je z ULDK i
// zrodel danych, a e2e nie wola uslug zewnetrznych. Prawdziwy przeplyw jest sprawdzany recznie.
const SECTIONS = [
  /1\.\s*Ocena/,
  /2\.\s*Ostatnie 10 sezonów/,
  /3\.\s*Dlaczego brakuje wody/,
  /4\.\s*Jak zatrzymać wodę na polu/,
  /5\.\s*Uprawa, która oszczędza wodę/,
  /6\.\s*Nawadnianie/,
  /7\.\s*Skąd są dane i na ile im ufać/,
];

test.describe('analiza i raport', () => {
  test(
    'od działki do raportu: uprawa, dziś, Analizuj; raport przeżywa odświeżenie',
    { tag: '@smoke' },
    async ({ page }) => {
      await mockAnalysisApi(page);
      await page.goto(`/analiza?dzialki=${PARCEL_ID}`);

      await expect(page.getByText('Działka 6509')).toBeVisible();
      await page.getByRole('button', { name: 'Analizuj' }).click();
      await expect(page.getByText('Wybierz uprawę, żeby przejść dalej.')).toBeVisible();

      // rolnik klika cala karte uprawy (natywne radio jest ukryte wizualnie)
      await page.locator('label[data-crop="winter_wheat"]').click();
      await expect(page.getByRole('radio', { name: /Zboża ozime/ })).toBeChecked();
      await page.getByRole('button', { name: 'Analizuj' }).click();

      await expect(page).toHaveURL(
        new RegExp(
          `/raport\\?dzialki=${PARCEL_ID.replace('.', '\\.')}&uprawa=winter_wheat&data=\\d{4}-\\d{2}-\\d{2}$`,
        ),
      );
      await expect(page.getByRole('heading', { level: 1, name: 'Raport wodny pola' })).toBeVisible();
      // jedna strona: jedno slowo na skali, szczegoly zwiniete na koncu
      await expect(page.getByTestId('verdict-word')).toHaveText('Sucho');
      await expect(page.getByTestId('sample-banner')).toContainText('nie podejmuj na ich podstawie decyzji');
      await expect(page.getByTestId('report-details')).toBeHidden();

      // "Pokaz szczegoly": parametr w adresie (link dla doradcy), sekcje w kolejnosci z zadania
      const toggle = page.getByTestId('show-details');

      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(page).toHaveURL(/widok=szczegoly/);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('verdict')).toContainText('Ryzyko suszy');
      await expect(page.locator('[data-report-section] h2')).toHaveText(SECTIONS);

      // odswiezenie zostawia szczegoly rozwiniete (stan w adresie) i przewija do nich
      await page.reload();
      await expect(page.getByTestId('verdict')).toBeVisible();
      await expect(page.getByTestId('show-details')).toBeInViewport();

      await page.getByTestId('show-details').click();
      await expect(page).not.toHaveURL(/widok=/);
      await expect(page.getByTestId('report-details')).toBeHidden();
    },
  );

  test('kotwica do sekcji rozwija szczegóły i przewija do niej; „Wszystkie zalecenia” też', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await page.goto(`${REPORT_URL}#przyczyny`);

    await expect(page.getByTestId('report-details')).toBeVisible();
    await expect(page.getByTestId('show-details')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#przyczyny')).toBeInViewport();

    // zwiniete szczegoly, potem link z pierwszego kroku do wszystkich zalecen
    await page.goto(REPORT_URL);
    await expect(page.getByTestId('report-details')).toBeHidden();
    await page.getByTestId('first-step').getByRole('link').last().click();
    await expect(page).toHaveURL(/widok=szczegoly#retencja$/);
    await expect(page.getByTestId('report-details')).toBeVisible();
    await expect(page.locator('#retencja')).toBeInViewport();
  });

  test('brak danych źródła i ograniczenia są nazwane wprost', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(detailed(REPORT_URL));

    await expect(page.locator('[data-source="forecast"]')).toContainText('Brak danych');
    await expect(page.locator('[data-limitation="sample_data"]')).toBeVisible();
  });

  test('niska pewność: zastrzeżenie przy werdykcie, jedna atrapa, nota źródła tylko dla doradcy', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await page.goto(detailed(LOW_CONFIDENCE_REPORT_URL));

    await expect(page.getByTestId('verdict-caveat-short')).toContainText('Ostrożnie: ta ocena jest niepewna');
    await expect(page.getByTestId('verdict-caveat')).toContainText('Ostrożnie: ta ocena jest niepewna');
    await expect(page.getByTestId('sample-banner')).toHaveAttribute('data-scope', 'some');

    const soil = page.locator('[data-source="soil"]');

    await expect(soil).toContainText('To źródło nie podało danych dla tego miejsca.');
    await expect(soil.getByText('no SoilGrids prediction')).toBeHidden();
    await soil.getByText('Szczegóły dla doradcy').click();
    await expect(soil.getByText(/no SoilGrids prediction/)).toBeVisible();
  });

  test('błąd analizy pokazuje komunikat i ponawia zapytanie', async ({ page }) => {
    await mockAnalysisApi(page, { analysisStatus: 502 });
    await page.goto(REPORT_URL);

    await expect(page.getByText('Nie udało się przygotować raportu')).toBeVisible();
    await page.unroute('**/api/analysis');
    await mockAnalysisApi(page);
    await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
    await expect(page.getByTestId('short-analysis')).toBeVisible();
  });

  test('link bez uprawy i daty prowadzi z powrotem do formularza', async ({ page }) => {
    await page.goto(`/raport?dzialki=${PARCEL_ID}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Brakuje danych do raportu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wybierz uprawę i datę' })).toHaveAttribute(
      'href',
      `/analiza?dzialki=${PARCEL_ID}`,
    );
  });

  test(
    'wydruk: bez nawigacji i przycisków, szczegóły dla doradcy rozwinięte',
    { tag: '@smoke' },
    async ({ page }) => {
      await mockAnalysisApi(page);
      // szczegoly zwiniete na ekranie - wydruk i tak ma calosc
      await page.goto(REPORT_URL);
      await expect(page.getByTestId('short-analysis')).toBeVisible();
      await page.emulateMedia({ media: 'print' });

      await expect(page.getByRole('button', { name: 'Drukuj / zapisz PDF' })).toBeHidden();
      await expect(page.locator('header').filter({ has: page.getByRole('navigation') })).toBeHidden();
      await expect(page.getByTestId('show-details')).toBeHidden();
      await expect(page.getByTestId('share-bar')).toBeHidden();
      await expect(page.getByTestId('report-details')).toBeVisible();
      await expect(page.getByText(/Klimatyczny bilans wodny/)).toBeVisible();
      await expect(page.getByTestId('advisor-notes')).toBeVisible();
    },
  );

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test(
      'formularz: przycisk zawsze widoczny, duże cele dotykowe, pole daty 16 px, bez poziomego przewijania',
      { tag: '@smoke' },
      async ({ page }) => {
        await mockAnalysisApi(page);
        await page.goto(`/analiza?dzialki=${PARCEL_ID}`);

        const submit = page.getByRole('button', { name: 'Analizuj' });

        await expect(submit).toBeInViewport();
        await page.getByRole('radio', { name: /Łąka lub pastwisko/ }).scrollIntoViewIfNeeded();
        await expect(submit).toBeInViewport();
        await expectNoZoomFont(page.getByLabel('Dzień analizy'));
        await expectTouchTargets(page.getByTestId('analysis-form').locator('label:has(input[type="radio"])'));
        await expectTouchTargets(page.getByTestId('analysis-form').getByRole('button'));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      },
    );

    test('raport mieści się na szerokość telefonu', async ({ page }) => {
      await mockAnalysisApi(page);
      await page.goto(REPORT_URL);
      await expect(page.getByTestId('short-analysis')).toBeVisible();

      await expectTouchTargets(page.getByTestId('report-header').getByRole('button'));
      await expectTouchTargets(page.getByTestId('report-header').getByRole('link'));
      // "Zapisz PDF" i "Udostepnij" przyklejone do dolu ekranu, zawsze pod kciukiem
      await expect(page.getByTestId('share-bar')).toBeInViewport();
      await expectTouchTargets(page.getByTestId('share-bar').getByRole('button'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);

      // szczegoly na telefonie: duzy przycisk na koncu, sekcje zwiniete, naglowek rozwija sekcje
      expect((await page.getByTestId('show-details').boundingBox())?.height).toBeGreaterThanOrEqual(56);
      await page.getByTestId('show-details').click();
      await expect(page.locator('#przyczyny > details')).not.toHaveAttribute('open');
      await page.locator('#przyczyny > details > summary').click();
      await expect(page.locator('#przyczyny > details')).toHaveAttribute('open');
      await expectTouchTargets(page.locator('[data-report-section] summary'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });
  });

  test('raport z prawdziwego silnika: ten rok na tle lat, kalendarz przewijany we własnym kontenerze', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAnalysisApi(page);
    await page.goto(detailed(DROUGHT_REPORT_URL));
    await openSections(page);

    await expect(page.getByTestId('verdict')).toContainText('Susza');
    await expect(page.getByTestId('history-summary')).toContainText('najsuchszy taki okres z 11 lat');
    await expect(page.getByTestId('sample-part')).toHaveCount(4);
    await expect(page.getByTestId('irrigation-deficit')).toContainText('brakuje ok. 136 l/m²');

    const calendar = page.getByTestId('risk-calendar');

    await expect(calendar.locator('tr[data-current] [data-status="drought"]')).toHaveCount(1);

    // kalendarz szerszy niz telefon przewija sie w swoim kontenerze, strona nie
    const scroller = calendar.getByRole('region');
    const widths = await scroller.evaluate((element) => [element.scrollWidth, element.clientWidth]);

    expect(widths[0]).toBeGreaterThan(widths[1] ?? 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test('eksport dla doradcy: CSV i JSON z danymi raportu', async ({ page }) => {
  await mockAnalysisApi(page);
  await page.goto(detailed(DROUGHT_REPORT_URL));
  await expect(page.getByTestId('verdict')).toBeVisible();

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Pobierz tabelę (CSV)' }).click(),
  ]);

  expect(csv.suggestedFilename()).toBe('raport-141201_1.0001.6509-2018-06-15.csv');
  const text = await (await csv.createReadStream()).toArray();

  expect(Buffer.concat(text).toString('utf8')).toContain('climaticBalance;balanceMm;-188.4;mm');

  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Pobierz dane (JSON)' }).click(),
  ]);

  expect(json.suggestedFilename()).toBe('raport-141201_1.0001.6509-2018-06-15.json');
});

test.describe('mapa pola w raporcie', () => {
  test.beforeEach(async ({ page }) => {
    await mockBasemap(page);
    await mockAnalysisApi(page);
  });

  test('szkic pola: rowy przez pole z liniami do jednej tabliczki, legenda, podziałka; na wydruku szkic', async ({
    page,
  }) => {
    await mockHydroApi(page, { tiles: DITCH_THROUGH_TILES });
    await page.goto(LOW_CONFIDENCE_REPORT_URL);

    const map = page.getByTestId('field-map');
    const sketch = page.getByTestId('field-sketch');

    await map.scrollIntoViewIfNeeded();
    await expect(map).toHaveAttribute('data-hydro', 'ready');
    await expect(sketch).toBeVisible();
    await expect(sketch).toContainText('Działka 6509');
    // dwa osobne rowy w polu: jedna tabliczka z laczna dlugoscia, linia do kazdego rowu
    await expect(page.getByTestId('field-sketch-fact')).toHaveText(/^2 rowy przez pole, razem \d+\sm$/);
    await expect(page.getByTestId('field-sketch-fact-line')).toHaveCount(2);
    await expect(page.getByTestId('field-sketch-highlight')).toBeAttached();
    await expect(page.getByTestId('field-sketch-scale')).toContainText(/\d+\sm/);
    await expect(page.getByTestId('field-sketch-legend')).toContainText('Rowy płynące przez pole');
    await expect(map).toContainText('BDOT10k, GUGiK (dane z 21 lis 2026)');
    // fakty o otoczeniu jako kafle pod karta
    await expect(page.getByTestId('field-map-nearest')).toContainText('Najbliższy rów melioracyjny');
    await expect(page.getByTestId('field-map-nearest')).toContainText('Przy samym polu');
    // zdjecie lotnicze dopiero na zadanie: dwie pigulki, wybor zapamietany
    await expect(page.getByTestId('field-map-canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Szkic', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Zdjęcie lotnicze' }).click();
    await expect(page.getByTestId('field-map-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 20_000,
    });
    await expect(sketch).toBeHidden();
    await expect(page.getByRole('checkbox', { name: 'Rowy i cieki' })).toBeChecked();

    // wydruk: zawsze szkic, bez plotna i bez przelacznika
    await page.emulateMedia({ media: 'print' });
    await expect(sketch).toBeVisible();
    await expect(page.getByTestId('field-map-canvas')).toBeHidden();
    await expect(page.getByTestId('field-map-mode')).toBeHidden();

    await page.emulateMedia({ media: 'screen' });
    // po przeladowaniu raport otwiera sie od razu na zdjeciu lotniczym
    await page.reload();
    await expect(page.getByTestId('field-map')).toHaveAttribute('data-mode', 'aerial');
    await page.getByRole('button', { name: 'Szkic', exact: true }).click();
    await expect(sketch).toBeVisible();
  });

  test('warstwa hydrografii nie odpowiada: szkic z samym obrysem pola i spokojna informacja', async ({
    page,
  }) => {
    await mockHydroApi(page, { status: 503 });
    await page.goto(LOW_CONFIDENCE_REPORT_URL);

    const map = page.getByTestId('field-map');

    await map.scrollIntoViewIfNeeded();
    await expect(map).toHaveAttribute('data-hydro', 'unavailable');
    await expect(map).toContainText('Danych o rowach i ciekach chwilowo brak');
    await expect(page.getByTestId('field-sketch-field')).toBeAttached();
    await expect(page.getByTestId('field-sketch-fact')).toHaveCount(0);
  });

  test('prawdziwy rów działki 6509 biegnie skrajem pola', async ({ page }) => {
    await mockHydroApi(page);
    await page.goto(LOW_CONFIDENCE_REPORT_URL);
    await page.getByTestId('field-map').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('field-sketch-fact')).toHaveText(/^Rów na skraju pola, \d+\sm$/);
  });

  test('szkic na telefonie mieści się w ekranie', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockHydroApi(page);
    await page.goto(LOW_CONFIDENCE_REPORT_URL);

    const sketch = page.getByTestId('field-sketch');

    await sketch.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('field-sketch-fact')).toBeVisible();

    const box = await sketch.boundingBox();

    expect(box?.width ?? 0).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('raport do oddania', () => {
  test('„Kopiuj link do raportu” wkłada krótki adres zapisanego raportu do schowka', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockAnalysisApi(page);
    await page.goto(LOW_CONFIDENCE_REPORT_URL);

    await page.getByRole('button', { name: 'Kopiuj link do raportu' }).click();
    await expect(page.getByRole('button', { name: 'Skopiowano link' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${new URL(page.url()).origin}/raport?raport=${LOW_CONFIDENCE_REPORT.meta.reportId}`,
    );
  });

  test('wydruk: nagłówek z nazwą aplikacji, datą i adresem, stopka ze źródłami', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(LOW_CONFIDENCE_REPORT_URL);
    await expect(page.getByTestId('short-analysis')).toBeVisible();
    await expect(page.getByTestId('print-header')).toBeHidden();

    await page.emulateMedia({ media: 'print' });

    const header = page.getByTestId('print-header');

    await expect(header).toBeVisible();
    await expect(header).toContainText('Grunt to Zdrowie');
    await expect(header).toContainText('Wygenerowano 21 listopada 2026');
    await expect(header).toContainText(
      `Raport: ${new URL(page.url()).origin}/raport?raport=${LOW_CONFIDENCE_REPORT.meta.reportId}`,
    );
    await expect(page.getByTestId('print-footer')).toContainText(
      `raport ${LOW_CONFIDENCE_REPORT.meta.reportId}`,
    );
    await expect(page.getByTestId('print-footer')).toContainText('Rowy, cieki i wody: GUGiK BDOT10k');
  });
});
