import type { Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL, PARCEL_ID } from './support/analysis-api';
import { mockBasemap, mockHydroApi } from './support/hydro-api';
import { expect, test } from './support/test';

// Granice dzialek od przyblizenia 14: ponizej 16 mapa pyta o kafle z14, od 16 o kafle z16. Kafel obciety przez
// usluge ewidencji (miasto) nie jest rysowany: przy 14-15 mapa prosi o przyblizenie, od 15 od razu pobiera jego kafle
// z16, a o obciety kafel z14 drugi raz nie pyta. Odpowiedzi trasy granic sa podstawione.
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

/** Klikniecie "Przybliz"/"Oddal" i czekanie na koniec animacji (mapa zapisuje przyblizenie po ruchu). */
async function zoomStep(page: Page, name: 'Przybliż' | 'Oddal') {
  const map = page.getByTestId('parcel-map');
  const before = await map.getAttribute('data-map-zoom');

  await page.getByRole('button', { name }).click();
  await expect(map).not.toHaveAttribute('data-map-zoom', before ?? '');
}

/** Oddala mape przyciskiem do przyblizenia 14-15 (dojazd do dzialki konczy sie miedzy 17 a 18). */
async function zoomOutTo14(page: Page, requested: string[]) {
  await expect.poll(() => requested.some((key) => key.startsWith('16/'))).toBe(true);

  for (let step = 0; step < 3; step += 1) await zoomStep(page, 'Oddal');

  await expect
    .poll(async () => Number(await page.getByTestId('parcel-map').getAttribute('data-map-zoom')))
    .toBeLessThan(15);

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

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await zoomOutTo14(page, requested);

    const coarse = requested.filter((key) => key.startsWith('14/'));

    expect(coarse).toContain('14/9174/5399');
    expect(coarse.length).toBeLessThanOrEqual(12);
    await expect(page.getByText('Przybliż, żeby zobaczyć granice działek.')).toBeHidden();
  });

  test('obcięty kafel z14: podpowiedź „przybliż”, po przybliżeniu znika', async ({ page }) => {
    const requested = await mockBoundaries(page, { truncated: true });

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await zoomOutTo14(page, requested);

    const hint = page.getByTestId('map-status');

    await expect(hint).toHaveText('Przybliż, żeby zobaczyć granice działek.');

    for (let step = 0; step < 2; step += 1) await zoomStep(page, 'Przybliż');

    await expect(hint).toBeHidden();
  });

  test('obcięty kafel z14 od przybliżenia 15: od razu kafle z16 zamiast podpowiedzi, o z14 nie pyta drugi raz', async ({
    page,
  }) => {
    const requested = await mockBoundaries(page, { truncated: true });
    const hint = page.getByText('Przybliż, żeby zobaczyć granice działek.');
    const asked = (key: string) => requested.filter((entry) => entry === key).length;

    await page.goto(`/mapa?dzialki=${PARCEL_ID}`);
    await expect.poll(() => requested.some((key) => key.startsWith('16/'))).toBe(true);

    const fineBefore = new Set(requested.filter((key) => key.startsWith('16/')));
    const fineAfter = () => new Set(requested.filter((key) => key.startsWith('16/') && !fineBefore.has(key)));

    // dwa stopnie oddalenia (przyblizenie 15-16): kafel z14 wraca obciety, mapa od razu dobiera kafle z16 widoku
    for (let step = 0; step < 2; step += 1) await zoomStep(page, 'Oddal');

    await expect.poll(() => asked('14/9174/5399')).toBe(1);
    await expect.poll(() => fineAfter().size).toBeGreaterThan(0);
    expect(fineAfter().size).toBeLessThanOrEqual(24);
    await expect(page.getByTestId('map-status')).toBeHidden();

    // ponizej 15: podpowiedz; z powrotem wyzej: bez podpowiedzi i bez drugiego pytania o obciety kafel z14
    await zoomStep(page, 'Oddal');
    await expect(hint).toBeVisible();
    await zoomStep(page, 'Przybliż');
    await expect(hint).toBeHidden();
    expect(asked('14/9174/5399')).toBe(1);
  });
});
