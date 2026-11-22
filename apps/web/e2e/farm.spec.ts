import type { Page } from '@playwright/test';

import { DROUGHT_REPORT } from '../src/features/report/fixtures/drought-report';
import { SAMPLE_REPORT } from '../src/features/report/fixtures/sample-report';
import { PARCEL } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { expect, test } from './support/test';

// Gospodarstwo (I2): kilka dzialek osobno. Dzialki i analizy podstawione: dzialka "B" ma susze, "A" ryzyko, "C"
// najpierw blad (ponowienie). Sprawdzamy kolejnosc "gdzie dzialac najpierw", limit dwoch analiz naraz i karty na
// telefonie.
const IDS = ['141201_1.0001.1', '141201_1.0001.2', '141201_1.0001.3'];
const FARM_URL = `/gospodarstwo?dzialki=${IDS.join(',')}&uprawa=winter_wheat&data=2018-06-15`;

async function mockFarm(page: Page, { failThird = false } = {}) {
  let inflight = 0;
  let maxInflight = 0;
  let thirdCalls = 0;

  await page.route('**/api/parcels/by-id**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('id') ?? PARCEL.id;

    return route.fulfill({ json: { ...PARCEL, id, number: id.split('.').at(-1) } });
  });
  await page.route('**/api/analysis', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { field: { parcelIds: string[] } };
    const id = body.field.parcelIds[0];

    inflight++;
    maxInflight = Math.max(maxInflight, inflight);
    await new Promise((resolve) => setTimeout(resolve, 150));
    inflight--;

    if (id === IDS[2] && failThird && thirdCalls++ === 0) {
      return route.fulfill({
        status: 502,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'x', status: 502, code: 'upstream_failed' }),
      });
    }

    return route.fulfill({ json: id === IDS[1] ? DROUGHT_REPORT : SAMPLE_REPORT });
  });

  return { maxInflight: () => maxInflight };
}

test.describe('gospodarstwo', () => {
  test('formularz: „każdą osobno” prowadzi do tabeli z kolejnością, raport działki z linku', async ({
    page,
  }) => {
    const api = await mockFarm(page);

    await page.goto(`/analiza?dzialki=${IDS.join(',')}`);
    await page.locator('label[data-crop="winter_wheat"]').click();
    await page.getByRole('radio', { name: /Każdą osobno/ }).check();
    await page.getByRole('button', { name: 'Analizuj' }).click();

    await expect(page).toHaveURL(/\/gospodarstwo\?dzialki=/);
    await expect(page.getByTestId('farm-progress')).toHaveText('Policzono 3 z 3');
    expect(api.maxInflight()).toBeLessThanOrEqual(2);

    const rows = page.getByTestId('farm-table').locator('tbody tr');

    await expect(rows.first()).toContainText('Działka 2');
    await expect(rows.first()).toContainText('Bardzo sucho – susza');
    await expectNoViolations(page);

    await rows.first().getByRole('link', { name: 'Pełny raport działki 2' }).click();
    await expect(page).toHaveURL(new RegExp(`/raport\\?dzialki=${IDS[1]?.replaceAll('.', '\\.')}`));
    await expect(page.getByTestId('verdict')).toContainText('Bardzo sucho – susza');
  });

  test('nieudana analiza działki ma ponowienie, reszta tabeli działa', async ({ page }) => {
    await mockFarm(page, { failThird: true });
    await page.goto(FARM_URL);

    await expect(page.getByTestId('farm-progress')).toHaveText('Policzono 2 z 3');
    await page.getByTestId('farm-table').getByRole('button', { name: 'Ponów' }).click();
    await expect(page.getByTestId('farm-progress')).toHaveText('Policzono 3 z 3');
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('karty zamiast tabeli, bez poziomego przewijania', async ({ page }) => {
      await mockFarm(page);
      await page.goto(FARM_URL);

      await expect(page.getByTestId('farm-progress')).toHaveText('Policzono 3 z 3');
      await expect(page.getByTestId('farm-cards')).toBeVisible();
      await expect(page.getByTestId('farm-table')).toBeHidden();
      await expect(page.getByTestId('farm-cards').locator('li').first()).toContainText('1. Działka 2');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      await expectNoViolations(page);
    });
  });
});
