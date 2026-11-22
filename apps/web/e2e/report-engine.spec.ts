import type { WaterReport } from '@app/contracts';

import { FIELD_REPORT } from '../src/features/report/fixtures/field-report';
import { FOREST_REPORT } from '../src/features/report/fixtures/forest-report';
import { HEAT_REPORT } from '../src/features/report/fixtures/heat-report';
import { mockReport, reportUrl } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { expect, test } from './support/test';

// Raport z pelnego silnika (runda 3 + uzytek z ewidencji): raporty z prawdziwego API zapisane w fixtures, bez
// uslug zewnetrznych - analiza, kafle hydrografii i podklad mapy sa podstawione.
test.beforeEach(async ({ page }) => {
  await mockBasemap(page);
  await mockHydroApi(page, { tiles: {} });
});

test.describe('użytek gruntu z ewidencji', () => {
  test('las: wyraźna ramka nad oceną, także na wydruku', async ({ page }) => {
    await mockReport(page, FOREST_REPORT);
    await page.goto(reportUrl(FOREST_REPORT));

    const notice = page.getByTestId('land-use-notice');

    await expect(notice).toContainText('Według ewidencji ta działka to las, nie pole uprawne.');
    await expect(notice).toContainText('a nie uprawę na tej działce');
    expect(
      await notice.evaluate((element) => {
        const verdict = document.querySelector('[data-testid="verdict"]');

        return verdict !== null && Boolean(element.compareDocumentPosition(verdict) & 4);
      }),
    ).toBe(true);

    await page.emulateMedia({ media: 'print' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link')).toBeHidden();
  });

  test('pole z łąką i rowem: użytki słowami w nagłówku, kody tylko dla doradcy, bez ramki', async ({
    page,
  }) => {
    await mockReport(page, FIELD_REPORT);
    await page.goto(reportUrl(FIELD_REPORT));

    await expect(page.getByTestId('report-header')).toContainText(
      'grunty orne klasy IVb–VI, łąka klasy V i rów',
    );
    await expect(page.getByTestId('report-header')).not.toContainText('RIVb');
    await expect(page.getByTestId('land-use-notice')).toHaveCount(0);

    const landUse = page.getByTestId('land-use');

    await expect(landUse.getByText(/RIVb, RV, RVI/)).toBeHidden();
    await landUse.getByText('Szczegóły dla doradcy').click();
    await expect(landUse.getByText('Klasoużytki z ewidencji: RIVb, RV, RVI, ŁV, W/ŁV.')).toBeVisible();
  });

  test('same łąki: „Policz dla łąki i pastwiska” otwiera ten sam raport z użytkami zielonymi', async ({
    page,
  }) => {
    const meadow: WaterReport = {
      ...FIELD_REPORT,
      landUse: {
        codes: ['ŁIV', 'ŁV'],
        kinds: ['meadow'],
        agricultural: true,
        soilClasses: ['IV', 'V'],
        cropHint: 'grassland',
        mismatch: 'grassland_only',
      },
    };

    await mockReport(page, meadow);
    await page.goto(reportUrl(meadow));

    const link = page
      .getByTestId('land-use-notice')
      .getByRole('link', { name: 'Policz dla łąki i pastwiska' });

    await expect(link).toHaveAttribute('href', /uprawa=grassland/);
    await expect(link).toHaveAttribute('href', /data=2018-06-15/);
  });
});

test.describe('raport z pełnego silnika', () => {
  test('dawki nawadniania, sezony z niedoborem, nadmiar wody i bieżący rok w kalendarzu', async ({
    page,
  }) => {
    await mockReport(page, FIELD_REPORT);
    await page.goto(reportUrl(FIELD_REPORT));

    await expect(page.getByTestId('irrigation-plan')).toContainText('4 podlania po 30 l/m² co 6 dni');
    await expect(page.getByTestId('deficit-seasons')).toContainText('w 9 z 10 poprzednich sezonów');

    const calendar = page.getByTestId('risk-calendar');

    await expect(calendar.locator('td[data-status="excess"]').first()).toBeAttached();
    // silnik 0.5.0: gleba kategorii I - w 2018 dwa okresy z susza przed data analizy
    await expect(calendar.locator('tr[data-current] td[data-status="ok"]')).toHaveCount(1);
    await expect(calendar.locator('tr[data-current] td[data-status="drought"]')).toHaveCount(2);
    await expect(calendar.getByRole('listitem').filter({ hasText: 'nadmiar wody' })).toBeVisible();
  });

  test('telefon: raport z silnika bez przewijania strony w poziomie', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockReport(page, FIELD_REPORT);
    await page.goto(reportUrl(FIELD_REPORT));
    await expect(page.getByTestId('irrigation-plan')).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('miejsca na polu', () => {
  test('telefon: numery na szkicu, lista miejsc, zalecenie wyróżnia swoje miejsce na szkicu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockReport(page, FIELD_REPORT);
    await page.goto(reportUrl(FIELD_REPORT));

    await expect(page.getByTestId('verdict-zones')).toContainText('Na polu są 4 miejsca');
    await expect(page.getByTestId('field-sketch-zone-number')).toHaveCount(4);
    await expect(page.getByTestId('zone-list').getByRole('button')).toHaveCount(4);
    await expect(page.getByTestId('field-sketch-zone-active')).toHaveCount(0);

    const show = page
      .locator('[data-measure="field_margin_trees"]')
      .getByRole('button', { name: 'Pokaż miejsce 1 na szkicu' });

    expect((await show.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await show.click();
    await expect(page.getByTestId('field-sketch-zone-active')).toHaveCount(1);
    await expect(page.getByTestId('field-sketch')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('wydruk: numery miejsc na szkicu i lista bez przycisków „Pokaż na szkicu”', async ({ page }) => {
    await mockReport(page, FIELD_REPORT);
    await page.goto(reportUrl(FIELD_REPORT));
    await expect(page.getByTestId('zone-list')).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByTestId('field-sketch-zone-number').first()).toBeVisible();
    await expect(page.getByTestId('zone-list')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pokaż miejsce 1 na szkicu' })).toBeHidden();
  });

  test('pole za małe: jedno zdanie z powodem zamiast pustej ramki', async ({ page }) => {
    await mockReport(page, FOREST_REPORT);
    await page.goto(reportUrl(FOREST_REPORT));

    await expect(page.getByTestId('zone-list-empty')).toContainText('satelita widzi kwadraty 10 × 10 m');
    await expect(page.getByTestId('field-sketch-zone-number')).toHaveCount(0);
    await expect(page.getByTestId('verdict-zones')).toHaveCount(0);
  });
});

test.describe('raport z zapisu (krótki link)', () => {
  test('otwiera zapisany raport bez liczenia: kiedy policzono i „Policz ponownie” z parametrami', async ({
    page,
  }) => {
    let analyses = 0;

    await page.route('**/api/analysis', (route) => {
      analyses += 1;

      return route.fulfill({ json: FIELD_REPORT });
    });
    await page.route(`**/api/reports/${FIELD_REPORT.meta.reportId}`, (route) =>
      route.fulfill({ json: FIELD_REPORT }),
    );
    await page.goto(`/raport?raport=${FIELD_REPORT.meta.reportId}`);

    await expect(page.getByTestId('verdict')).toBeVisible();
    await expect(page.getByTestId('report-stored')).toContainText('Policzono 22 listopada 2026, 00:55');

    const recompute = page.getByRole('link', { name: 'Policz ponownie' });

    await expect(recompute).toHaveAttribute(
      'href',
      '/raport?dzialki=080904_5.0001.349%2F1&uprawa=winter_wheat&data=2018-06-15',
    );
    expect(analyses).toBe(0);

    await recompute.click();
    await expect(page.getByTestId('verdict')).toBeVisible();
    await expect(page.getByTestId('report-stored')).toHaveCount(0);
    expect(analyses).toBe(1);
  });

  test('nieistniejący raport: komunikat i wyjście do mapy', async ({ page }) => {
    await page.route('**/api/reports/r-00000000', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'Not found', status: 404, code: 'not_found' }),
      }),
    );
    await page.goto('/raport?raport=r-00000000');

    await expect(page.getByRole('heading', { level: 1, name: 'Nie ma takiego raportu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wybierz pole na mapie' })).toHaveAttribute('href', '/');
  });

  test('zły format identyfikatora: ten sam komunikat bez pytania serwera', async ({ page }) => {
    await page.goto('/raport?raport=cokolwiek');

    await expect(page.getByRole('heading', { level: 1, name: 'Nie ma takiego raportu' })).toBeVisible();
  });
});

test.describe('otoczenie pola', () => {
  const PROTECTED: WaterReport = {
    ...HEAT_REPORT,
    surroundings: HEAT_REPORT.surroundings && {
      ...HEAT_REPORT.surroundings,
      protectedAreas: [
        { kind: 'national_park', name: 'Biebrzański Park Narodowy' },
        { kind: 'natura2000', name: 'Dolina Biebrzy' },
      ],
    },
  };

  test('obszar chroniony u góry, karta otoczenia i „Zanim zaczniesz”; także na wydruku i bez naruszeń axe', async ({
    page,
  }) => {
    await mockReport(page, PROTECTED);
    await page.goto(reportUrl(PROTECTED));

    await expect(page.getByTestId('protected-area-notice')).toContainText(
      'Pole leży w obszarze chronionym: Biebrzański Park Narodowy; Natura 2000: Dolina Biebrzy.',
    );
    await expect(page.getByTestId('surroundings-card')).toContainText('rosną przy 0 m z 1900 m granicy pola');
    await expect(page.getByTestId('recommendation-notes').first()).toContainText('Zanim zaczniesz');
    await expectNoViolations(page);

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('protected-area-notice')).toBeVisible();
    await expect(page.getByTestId('surroundings-card')).toBeVisible();
    await expect(page.getByTestId('recommendation-notes').first()).toBeVisible();
  });

  test('telefon: karta otoczenia i dopiski bez przewijania w poziomie', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockReport(page, HEAT_REPORT);
    await page.goto(reportUrl(HEAT_REPORT));
    await expect(page.getByTestId('surroundings-card')).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('szkic: las, żywopłot i jaz z kafli otoczenia, z legendą', async ({ page }) => {
    const [lng, lat] = HEAT_REPORT.field.centroid;

    await page.route('**/api/context/tile**', (route) => {
      const layer = new URL(route.request().url()).searchParams.get('layer');
      const features =
        layer === 'waterworks'
          ? [{ kind: 'weir', name: null, geometry: { type: 'Point', coordinates: [lng + 0.0005, lat] } }]
          : [
              {
                kind: 'hedge',
                name: null,
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [lng - 0.001, lat - 0.0005],
                    [lng + 0.001, lat - 0.0005],
                  ],
                },
              },
            ];

      return route.fulfill({ json: { layer, features, truncated: false, importedAt: null } });
    });
    await mockReport(page, HEAT_REPORT);
    await page.goto(reportUrl(HEAT_REPORT));

    const legend = page.getByTestId('field-sketch-legend');

    await expect(page.getByTestId('field-sketch-structure').first()).toBeAttached();
    await expect(legend).toContainText('Rząd drzew albo żywopłot');
    await expect(legend).toContainText('Jaz, zapora albo śluza');
  });
});
