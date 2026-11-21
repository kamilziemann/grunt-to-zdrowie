import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import { describe, expect, it } from 'vitest';

import type { AppLocale } from './locale';
import { useAppLocale } from './use-app-locale';

const NO_MESSAGES = {};

const wrapper = (locale: AppLocale) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <IntlProvider locale={locale} messages={NO_MESSAGES}>
        {children}
      </IntlProvider>
    );
  };

describe('useAppLocale', () => {
  it.each(['pl', 'en'] as const)('zwraca jezyk z IntlProvider (%s)', (locale) => {
    expect(renderHook(() => useAppLocale(), { wrapper: wrapper(locale) }).result.current).toBe(locale);
  });
});
