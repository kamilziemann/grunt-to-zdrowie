// Pomocniki testow komponentow z tlumaczeniami: dostawca use-intl z prawdziwymi komunikatami (domyslnie pl, wiec
// asercje na polskim tekscie pozostaja prawdziwe) i tlumacz do wyliczania oczekiwanych tekstow.
import { render, type RenderResult } from '@testing-library/react';
import { createTranslator, IntlProvider } from 'use-intl';
import type { ReactElement, ReactNode } from 'react';

import { FULL_CATALOG as MESSAGES } from '@/i18n/full-catalog';
import type { AppLocale } from '@/lib/locale';

export function IntlTestProvider({ locale = 'pl', children }: { locale?: AppLocale; children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </IntlProvider>
  );
}

/** render() z dostawca use-intl (domyslnie `pl`). */
export function renderWithIntl(ui: ReactElement, locale: AppLocale = 'pl'): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => <IntlTestProvider locale={locale}>{children}</IntlTestProvider>,
  });
}

/** Tlumacz poza Reactem: `translator('problems')('not_found')`. */
export function translator<
  N extends 'problems' | 'common' | 'nav' | 'auth' | 'errors' | 'parcels' | 'design',
>(namespace: N, locale: AppLocale = 'pl') {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace });
}
