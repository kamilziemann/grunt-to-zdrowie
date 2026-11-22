import type { Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL, PARCEL_ID } from './support/analysis-api';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { expect, test } from './support/test';

// Granice dzialek od przyblizenia 14: ponizej 16 mapa pyta o kafle z14, od 16 o kafle z16. Kafel obciety przez
// usluge ewidencji (miasto) nie jest rysowany, a mapa prosi o przyblizenie. Odpowiedzi trasy granic sa podstawione.
const OUTLINE = { id: PARCEL.id, number: PARCEL.number, geometry: PARCEL.geometry, center: PARCEL.centroid };

async function mockBoundaries(page: Page, { truncated }: { truncated: boolean }): Promise<string[]> {
  const requested: string[] = [];

  await page.route('**/api/parcels/boundaries**', (route) => {
    const url = new URL(route.request().url());
    const zoom = url.searchParams.get('z') ?? '16';

    requested.push(`${zoom}/${url.searchParams.get('x') ?? ''}/${url.searchParams.get('y') ?? ''}`);

    return route.fulfill({ json: { items: [OUTLINE], truncated: zoom === '14' && truncated } });
  });

  return requested;
}

/** Oddala mape przyciskiem do przyblizenia ponizej 16 (dojazd do dzialki konczy sie na 17). */
async function zoomOutTo14(page: Page, requested: string[]) {
  await expect.poll(() => requested.some((key) => key.startsWith('16/'))).toBe(true);

  for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Oddal' }).click();

  await expect.poll(() => requested.filter((key) => key.startsWith('14/')).length).toBeGreaterThan(0);
}

test.describe('granice działek od przybliżenia 14', () => {
  test.beforeEach(async ({ page }) => {
    await mockBasemap(page);
    await mockAnalysisApi(page);
    await mockHydroApi(page);
  });

  test('poniżej 16 kilka kafli z14, bez podpowiedzi przy pełnych kaflach', async ({ page }) => {
    const requested = await mockBoundaries(page, { truncated: false });

    await page.goto(`/?dzialki=${PARCEL_ID}`);
    await zoomOutTo14(page, requested);

    const coarse = requested.filter((key) => key.startsWith('14/'));

    expect(coarse).toContain('14/9174/5399');
    expect(coarse.length).toBeLessThanOrEqual(12);
    await expect(page.getByText('Przybliż, żeby zobaczyć granice działek.')).toBeHidden();
  });

  test('obcięty kafel z14: podpowiedź „przybliż”, po przybliżeniu znika', async ({ page }) => {
    const requested = await mockBoundaries(page, { truncated: true });

    await page.goto(`/?dzialki=${PARCEL_ID}`);
    await zoomOutTo14(page, requested);

    const hint = page.getByTestId('map-status');

    await expect(hint).toHaveText('Przybliż, żeby zobaczyć granice działek.');

    for (let step = 0; step < 2; step += 1) await page.getByRole('button', { name: 'Przybliż' }).click();

    await expect(hint).toBeHidden();
  });
});
