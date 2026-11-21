// Jezyk biezacej strony jako AppLocale (z IntlProvider trasy `{-$locale}`), np. do `localizePath` w formularzach GET.
import { useLocale } from 'use-intl';

import { asLocale, DEFAULT_LOCALE, type AppLocale } from './locale';

export function useAppLocale(): AppLocale {
  return asLocale(useLocale()) ?? DEFAULT_LOCALE;
}
