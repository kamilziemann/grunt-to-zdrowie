// Uklad ekranu mapy w e2e: prostokaty elementow i sprawdzenie, ze nic nie zaslania przyciskow mapy (szyna).
import { expect, type Locator, type Page } from '@playwright/test';

export type Box = { x: number; y: number; width: number; height: number };

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();

  expect(box, 'element widoczny na ekranie').not.toBeNull();

  return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Przyciski mapy w szynie: przybliz, oddal, gdzie jestem (wlasne kafle zamiast kontrolek MapLibre). */
export function mapButtons(page: Page): Locator[] {
  return ['zoom-in', 'zoom-out', 'locate'].map((name) => page.locator(`[data-map-button=${name}]`));
}

/** Zaden z elementow sterujacych nie wchodzi na przyciski mapy (porownanie prostokatow). */
export async function expectMapButtonsUncovered(page: Page, others: readonly Locator[]) {
  const buttons = await Promise.all(mapButtons(page).map(boxOf));
  const covering = await Promise.all(others.map(boxOf));

  for (const button of buttons) {
    for (const [index, other] of covering.entries()) {
      expect(overlaps(button, other), `element ${index} zaslania przycisk mapy`).toBe(false);
    }
  }
}
