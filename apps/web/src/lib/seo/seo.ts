// Metadane stron (`head` tras): tytul z marka, opis, Open Graph i wersje jezykowe. Adres kanoniczny i hreflang
// wymagaja pelnych URL-i - powstaja, gdy build zna adres serwisu (`VITE_SITE_URL`), inaczej sa pomijane.
import { APP_NAME } from '@app/config';
import { seoHead, type SeoInput } from '@app/start-kit';
import { createTranslator, type Messages, type NamespaceKeys, type NestedKeyOf } from 'use-intl';

import { delocalizePath, ENABLED_LOCALES, localizePath, type AppLocale } from '../locale';

/** Nazwa marki w tytulach stron (jedno zrodlo: APP_NAME z @app/config). */
export const BRAND = APP_NAME;

const OG_LOCALES: Record<AppLocale, string> = { pl: 'pl_PL', en: 'en_GB' };

export interface PageHeadInput extends Omit<SeoInput, 'siteName' | 'canonical' | 'alternates' | 'locale'> {
  /** sciezka strony (z lib/routes) - z niej adres kanoniczny i wersje jezykowe */
  path?: string;
  locale?: AppLocale;
}

export function pageHead({ path, locale = 'pl', ...input }: PageHeadInput) {
  const site = import.meta.env.VITE_SITE_URL;
  const absolute = (href: string) => (site ? new URL(href, site).toString() : undefined);
  const bare = path ? delocalizePath(path) : undefined;
  const alternates =
    // hreflang tylko dla wlaczonych jezykow i tylko gdy jest wiecej niz jeden
    bare && site && ENABLED_LOCALES.length > 1
      ? Object.fromEntries(ENABLED_LOCALES.map((code) => [code, absolute(localizePath(bare, code)) ?? '']))
      : undefined;

  return seoHead({
    ...input,
    siteName: BRAND,
    locale: OG_LOCALES[locale],
    canonical: bare ? absolute(localizePath(bare, locale)) : undefined,
    alternates,
  });
}

interface HeadMatch {
  routeId: string;
  loaderData?: unknown;
}

type MatchMessages = { locale?: AppLocale; messages?: Partial<Messages> } | undefined;

/**
 * Jezyk z layoutu `{-$locale}` i komunikaty wszystkich dopasowanych tras (dla `head`, ktory nie ma hookow use-intl):
 * layout jezyka daje komunikaty wspolne, a layouty sekcji (np. `_dev`) dokladaja swoje przestrzenie.
 */
export function headLocale(matches: readonly HeadMatch[]): {
  locale: AppLocale;
  messages: Partial<Messages>;
} {
  let locale: AppLocale = 'pl';
  const messages: Partial<Messages> = {};

  for (const match of matches) {
    const data = match.loaderData as MatchMessages;

    if (match.routeId === '/{-$locale}' && data?.locale) locale = data.locale;

    if (data?.messages) Object.assign(messages, data.messages);
  }

  return { locale, messages };
}

/** Tlumacz przestrzeni komunikatow w `head` trasy (tytuly i opisy stron w jezyku adresu). */
export function headTranslator<N extends NamespaceKeys<Messages, NestedKeyOf<Messages>>>(
  matches: readonly HeadMatch[],
  namespace: N,
) {
  const { locale, messages } = headLocale(matches);

  return createTranslator({ locale, messages: messages as Messages, namespace });
}
