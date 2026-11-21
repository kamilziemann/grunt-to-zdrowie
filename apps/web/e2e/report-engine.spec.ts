import type { WaterReport } from '@app/contracts';

import { FIELD_REPORT } from '../src/features/report/fixtures/field-report';
import { FOREST_REPORT } from '../src/features/report/fixtures/forest-report';
import { mockReport, reportUrl } from './support/analysis-api';
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
    await expect(calendar.locator('tr[data-current] td[data-status="ok"]')).toHaveCount(3);
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
