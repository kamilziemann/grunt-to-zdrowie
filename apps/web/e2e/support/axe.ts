import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** axe z regulami WCAG 2.x A i AA; naruszenie = blad testu (regul nie wylaczamy). */
export async function expectNoViolations(page: Page) {
  await settleTransitions(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  expectEmpty(results.violations);
}

/**
 * Hierarchia naglowkow bez przeskokow (h1 -> h3) - WCAG 1.3.1, nawigacja czytnikiem po naglowkach. Regula axe
 * `heading-order` jest „best practice”, wiec nie wchodzi do `expectNoViolations` (tagi WCAG).
 */
export async function expectHeadingOrder(page: Page) {
  const results = await new AxeBuilder({ page }).withRules(['heading-order']).analyze();

  expectEmpty(results.violations);
}

/**
 * Czeka na koniec skonczonych przejsc i animacji CSS (np. `pressable` po kliknieciu filtra albo hover pod kursorem):
 * axe w polowie przejscia tla mierzy kontrast koloru posredniego i zglasza falszywe `color-contrast`. Animacje
 * nieskonczone (kropki „na zywo”) pomijamy, bo nigdy sie nie koncza.
 */
async function settleTransitions(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

function expectEmpty(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  expect(
    violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}
