import { expect, type Locator } from '@playwright/test';

/**
 * Samodzielne linki i przyciski (nie w zdaniu) maja cel dotykowy min. 44 x 44 px; WCAG 2.5.8 przepuszcza mniejsze tylko dzieki odstepom, a na telefonie trudno w nie trafic.
 * Elementy niewidoczne (0 x 0) pomijamy.
 */
export async function expectTouchTargets(targets: Locator) {
  const small = await targets.evaluateAll((elements) =>
    elements
      .map((element) => {
        const box = element.getBoundingClientRect();

        return {
          text: (element.textContent ?? '').trim().slice(0, 40),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((box) => box.width + box.height > 0 && (box.width < 44 || box.height < 44)),
  );

  expect(small).toEqual([]);
}

/**
 * Jak `expectTouchTargets`, ale mierzy pole klikniecia, a nie prostokat elementu: `elementFromPoint` wzdluz osi przez
 * srodek elementu przewinietego na srodek ekranu. Widzi pole z pseudo-elementu (`after:absolute`), ktore wystaje poza
 * tytul w jednej linii, i pole zabrane przez sasiada nalozonego na element (np. pseudo-element innego linku).
 * Dla elementow blokowych: srodek linku `inline` lamanego na dwie linie moze wypasc w szczelinie miedzy liniami.
 */
export async function expectHitTargets(targets: Locator) {
  const small = await targets.evaluateAll((elements) => {
    const min = 44;

    const hits = (element: Element, x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);

      return hit !== null && (hit === element || element.contains(hit));
    };

    // ile pikseli od srodka w danym kierunku trafia jeszcze w element (wiecej niz `min` nie trzeba)
    const reach = (element: Element, x: number, y: number, dx: number, dy: number) => {
      let step = 0;

      while (step < min && hits(element, x + dx * (step + 1), y + dy * (step + 1))) step += 1;

      return step;
    };

    return elements.flatMap((element) => {
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const box = element.getBoundingClientRect();

      if (box.width + box.height === 0) return [];
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const center = hits(element, x, y);
      const width = center ? reach(element, x, y, -1, 0) + reach(element, x, y, 1, 0) + 1 : 0;
      const height = center ? reach(element, x, y, 0, -1) + reach(element, x, y, 0, 1) + 1 : 0;

      return width < min || height < min
        ? [{ text: (element.textContent ?? '').trim().slice(0, 40), width, height }]
        : [];
    });
  });

  expect(small).toEqual([]);
}
