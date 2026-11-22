import { expect, type Locator } from '@playwright/test';

/** Pole tekstowe min. 16 px: iOS nie przybliza strony przy fokusie (tekst podstawowy aplikacji ma 17 px). */
export async function expectNoZoomFont(field: Locator) {
  const size = await field.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

  expect(size).toBeGreaterThanOrEqual(16);
}
