import { describe, expect, it } from 'vitest';

import { FULL_CATALOG } from './full-catalog';
import { GLOBAL_ERROR_MESSAGES } from './global-error-messages';

const { pl, en } = FULL_CATALOG;

describe('komunikaty strony bledu globalnego', () => {
  it('to wycinek messages/{pl,en} (te same teksty, wszystkie kody problemow)', () => {
    for (const [locale, catalog] of [
      ['pl', pl],
      ['en', en],
    ] as const) {
      expect(GLOBAL_ERROR_MESSAGES[locale]).toEqual({
        errors: { globalTitle: catalog.errors.globalTitle },
        common: { tryAgain: catalog.common.tryAgain },
        problems: catalog.problems,
      });
    }
  });
});
