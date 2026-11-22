import type { Locator, Page } from '@playwright/test';

import { mockAnalysisApi, PARCEL_ID } from './support/analysis-api';
import { expectNoViolations } from './support/axe';
import { mockMapServices } from './support/map-services';
import { expect, test } from './support/test';

// Blad formularza analizy widac od razu: "Analizuj dzialke" bez uprawy (albo ze zla data) przewija ciemny panel do
// pierwszego blednego pola, daje mu fokus i pokazuje krotkie powiadomienie. Komunikat przy polu zostaje.
const CROP_MISSING = 'Wybierz uprawę, żeby przejść dalej.';
const CROP_TOAST = 'Wybierz uprawę, żeby policzyć wynik';

async function openForm(page: Page) {
  await mockAnalysisApi(page);
  await mockMapServices(page);
  await page.goto(`/analiza?dzialki=${PARCEL_ID}`);
  await expect(page.getByText('Działka 6509')).toBeVisible();
}

/** Element stoi w widocznej czesci panelu: pod gorna krawedzia panelu i nad przyklejonym przyciskiem. */
async function expectAboveSubmit(page: Page, target: Locator) {
  const submit = page.getByRole('button', { name: 'Analizuj działkę' });

  await expect(async () => {
    const [box, bar, panel] = await Promise.all([
      target.boundingBox(),
      submit.boundingBox(),
      page.getByTestId('check-panel').boundingBox(),
    ]);

    if (!box || !bar || !panel) throw new Error('brak elementu');

    expect(box.y).toBeGreaterThanOrEqual(panel.y);
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
  }).toPass();
}

async function expectCropError(page: Page) {
  const group = page.getByRole('group', { name: 'Co rośnie na działce?' });
  const message = page.getByText(CROP_MISSING);

  await page.getByRole('button', { name: 'Analizuj działkę' }).click();

  await expect(message).toBeVisible();
  await expectAboveSubmit(page, message);
  await expectAboveSubmit(page, page.locator('label[data-crop="winter_wheat"]'));
  // fokus w grupie upraw, komunikat powiazany z grupa (czytnik czyta go przy wejsciu w grupe)
  await expect(group.locator('input:focus')).toHaveCount(1);
  await expect(group).toHaveAttribute(
    'aria-describedby',
    new RegExp((await message.getAttribute('id')) ?? 'brak'),
  );
  await expect(page.getByTestId('toasts')).toContainText(CROP_TOAST);
}

test.describe('formularz analizy: błąd widać od razu', () => {
  test('brak uprawy: panel przewija się do upraw, fokus, powiadomienie, axe bez naruszeń', async ({
    page,
  }) => {
    await openForm(page);
    await expectCropError(page);

    // drugie klikniecie nie dokleja kopii powiadomienia
    await page.getByRole('button', { name: 'Analizuj działkę' }).click();
    await expect(page.getByTestId('toasts').getByRole('listitem')).toHaveCount(1);
    await expectNoViolations(page);

    // powiadomienie da sie zamknac; komunikat przy polu zostaje
    await page.getByRole('button', { name: 'Zamknij powiadomienie' }).click();
    await expect(page.getByTestId('toasts').getByRole('listitem')).toHaveCount(0);
    await expect(page.getByText(CROP_MISSING)).toBeVisible();
  });

  test('zła data: fokus i przewinięcie do pola daty, powiadomienie', async ({ page }) => {
    await openForm(page);
    await page.locator('label[data-crop="winter_wheat"]').click();
    await page.getByLabel('Dzień analizy').fill('2010-06-01');
    await page.getByRole('button', { name: 'Analizuj działkę' }).click();

    await expect(page.getByLabel('Dzień analizy')).toBeFocused();
    await expect(page.getByLabel('Dzień analizy')).toHaveAttribute('aria-invalid', 'true');
    await expectAboveSubmit(page, page.getByLabel('Dzień analizy'));
    await expect(page.getByTestId('toasts')).toContainText('Popraw dzień analizy');
    await expect(page).toHaveURL(/\/analiza/);
  });

  test.describe('telefon', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test(
      'brak uprawy: uprawy nad przyciskiem, powiadomienie u góry nie zasłania przycisku',
      { tag: '@smoke' },
      async ({ page }) => {
        await openForm(page);
        await expectCropError(page);

        const [toast, submit] = await Promise.all([
          page.getByTestId('toasts').getByRole('listitem').boundingBox(),
          page.getByRole('button', { name: 'Analizuj działkę' }).boundingBox(),
        ]);

        if (!toast || !submit) throw new Error('brak elementu');

        expect(toast.y + toast.height).toBeLessThan(submit.y);
        await expectNoViolations(page);
      },
    );

    test('ograniczony ruch: przewinięcie bez animacji', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openForm(page);
      await page.getByRole('button', { name: 'Analizuj działkę' }).click();

      // bez plynnego przewijania pole jest na miejscu od razu (pierwszy pomiar, bez czekania)
      const scrollTop = await page.getByTestId('check-panel').evaluate((panel) => panel.scrollTop);

      expect(scrollTop).toBeGreaterThan(0);
      await expect(page.getByTestId('toasts').getByRole('listitem')).not.toHaveCSS('animation-name', /enter/);
    });
  });
});
