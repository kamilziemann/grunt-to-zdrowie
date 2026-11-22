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
import { expectTouchTargets } from './support/touch-targets';

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
  test('od działki do raportu: uprawa, dziś, Analizuj; raport przeżywa odświeżenie', async ({ page }) => {
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
    await expect(page.getByTestId('verdict')).toContainText('Ryzyko suszy');
    await expect(page.getByTestId('sample-banner')).toContainText('nie podejmuj na ich podstawie decyzji');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(SECTIONS);

    await page.reload();
    await expect(page.getByTestId('verdict')).toBeVisible();
  });

  test('brak danych źródła i ograniczenia są nazwane wprost', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(REPORT_URL);

    await expect(page.locator('[data-source="forecast"]')).toContainText('Brak danych');
    await expect(page.locator('[data-limitation="sample_data"]')).toBeVisible();
  });

  test('niska pewność: zastrzeżenie przy werdykcie, jedna atrapa, nota źródła tylko dla doradcy', async ({
    page,
  }) => {
    await mockAnalysisApi(page);
    await page.goto(LOW_CONFIDENCE_REPORT_URL);

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
    await expect(page.getByTestId('verdict')).toBeVisible();
  });

  test('link bez uprawy i daty prowadzi z powrotem do formularza', async ({ page }) => {
    await page.goto(`/raport?dzialki=${PARCEL_ID}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Brakuje danych do raportu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wybierz uprawę i datę' })).toHaveAttribute(
      'href',
      `/analiza?dzialki=${PARCEL_ID}`,
    );
  });

  test('wydruk: bez nawigacji i przycisków, szczegóły dla doradcy rozwinięte', async ({ page }) => {
    await mockAnalysisApi(page);
    await page.goto(REPORT_URL);
    await expect(page.getByTestId('verdict')).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByRole('button', { name: 'Drukuj / zapisz PDF' })).toBeHidden();
    await expect(page.locator('header').filter({ has: page.getByRole('navigation') })).toBeHidden();
    await expect(page.getByText(/Klimatyczny bilans wodny/)).toBeVisible();
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('formularz: przycisk zawsze widoczny, duże cele dotykowe, pole daty 16 px, bez poziomego przewijania', async ({
      page,
    }) => {
      await mockAnalysisApi(page);
      await page.goto(`/analiza?dzialki=${PARCEL_ID}`);

      const submit = page.getByRole('button', { name: 'Analizuj' });

      await expect(submit).toBeInViewport();
      await page.getByRole('radio', { name: /Łąka lub pastwisko/ }).scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await expect(page.getByLabel('Dzień analizy')).toHaveCSS('font-size', '16px');
      await expectTouchTargets(page.getByTestId('analysis-form').locator('label:has(input[type="radio"])'));
      await expectTouchTargets(page.getByTestId('analysis-form').getByRole('button'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });

    test('raport mieści się na szerokość telefonu', async ({ page }) => {
      await mockAnalysisApi(page);
      await page.goto(REPORT_URL);
      await expect(page.getByTestId('verdict')).toBeVisible();

      await expectTouchTargets(page.getByTestId('report-header').getByRole('button'));
      await expectTouchTargets(page.getByTestId('report-header').getByRole('link'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });
  });

  test('raport z prawdziwego silnika: ten rok na tle lat, kalendarz przewijany we własnym kontenerze', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAnalysisApi(page);
    await page.goto(DROUGHT_REPORT_URL);

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
  await page.goto(DROUGHT_REPORT_URL);
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

  test('szkic pola: rów przez pole z linią odniesienia, legenda, podziałka; na wydruku szkic', async ({
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
    await expect(page.getByTestId('field-sketch-fact')).toHaveText(/^Rów przez pole, \d+ m$/);
    await expect(page.getByTestId('field-sketch-highlight')).toBeAttached();
    await expect(page.getByTestId('field-sketch-scale')).toContainText(/\d+ m/);
    await expect(page.getByTestId('field-sketch-legend')).toContainText('Rów płynący przez pole');
    await expect(map).toContainText('BDOT10k, GUGiK (dane z 21 lis 2026)');
    await expect(page.getByTestId('field-map-nearest')).toContainText(
      'Najbliższy rów melioracyjny: przy samym polu albo przez pole.',
    );
    // zdjecie lotnicze dopiero na zadanie
    await expect(page.getByTestId('field-map-canvas')).toHaveCount(0);

    await page.getByRole('button', { name: 'Pokaż na zdjęciu lotniczym' }).click();
    await expect(page.getByTestId('field-map-canvas')).toBeVisible({ timeout: 20_000 });
    await expect(sketch).toBeHidden();

    // wydruk: zawsze szkic, bez plotna i bez przelacznika
    await page.emulateMedia({ media: 'print' });
    await expect(sketch).toBeVisible();
    await expect(page.getByTestId('field-map-canvas')).toBeHidden();
    await expect(page.getByTestId('field-map-toggle')).toBeHidden();

    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: 'Wróć do szkicu' }).click();
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
    await expect(page.getByTestId('field-sketch-fact')).toHaveText(/^Rów na skraju pola, \d+ m$/);
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
    await expect(page.getByTestId('verdict')).toBeVisible();
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
