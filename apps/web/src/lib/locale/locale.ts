// Jezyki interfejsu i jezyk w ADRESIE: `/` = polski (domyslny, bez prefiksu), `/en/...` = angielski. Jezyk musi byc w
// URL, bo Workers Cache trzyma strony po sciezce i nie widzi ciasteczek - ten sam adres = ten sam HTML dla wszystkich.
// Czysta logika, wspolna dla serwera i przegladarki; trasy: src/routes/{-$locale}.
/** Jezyki z tlumaczeniami (messages/<jezyk>) - utrzymywane i testowane, nawet gdy wylaczone. */
export const LOCALES = ['pl', 'en'] as const;

export type AppLocale = (typeof LOCALES)[number];

/**
 * Jezyki dostepne dla uzytkownikow. Dzis tylko polski: `/en/...` przekierowuje na polski adres, przelaczniki jezyka
 * i hreflang znikaja. Wlaczenie angielskiego = dopisanie 'en' tutaj (tlumaczenia i trasy sa gotowe).
 */
export const ENABLED_LOCALES: readonly AppLocale[] = ['pl'];

export function isLocaleEnabled(locale: AppLocale): boolean {
  return ENABLED_LOCALES.includes(locale);
}

export const DEFAULT_LOCALE: AppLocale = 'pl';

/**
 * Jezyk tresci: tresci wprowadzane przez uzytkownikow i dane z zewnetrznych zrodel sa po polsku niezaleznie od jezyka
 * interfejsu. Elementy z trescia dostaja `lang={CONTENT_LANG}`, zeby czytnik ekranu w angielskim interfejsie czytal
 * je po polsku, a nie z angielska wymowa (WCAG 3.1.2, jezyk czesci).
 */
export const CONTENT_LANG: AppLocale = 'pl';

/**
 * Strefa wszystkich dat w interfejsie (takze po angielsku: aplikacja dziala w polskiej strefie). Bez niej serwer formatuje
 * w strefie srodowiska - na Workers UTC, czyli 1-2 h wstecz - a przegladarka w swojej (rozjazd przy hydratacji).
 */
export const APP_TIME_ZONE = 'Europe/Warsaw';

/** Nazwy jezykow w nich samych (nie tlumaczone): pokazuja sie w przelaczniku. */
export const LOCALE_NAMES: Record<AppLocale, string> = { pl: 'Polski', en: 'English' };

/** Wartosc -> jezyk aplikacji albo undefined, gdy nieobslugiwana. */
export function asLocale(value: string | null | undefined): AppLocale | undefined {
  return LOCALES.find((locale) => locale === value);
}

/** Parametr trasy `{-$locale}`: brak = domyslny; nieznana albo wylaczona wartosc = undefined (trasa: 404/przekierowanie). */
export function localeFromParam(param: string | undefined): AppLocale | undefined {
  if (param === undefined) return DEFAULT_LOCALE;

  const locale = param === DEFAULT_LOCALE ? undefined : asLocale(param);

  return locale && isLocaleEnabled(locale) ? locale : undefined;
}

/** Parametr to jezyk z tlumaczeniami, ale wylaczony (`/en/...` przy samym polskim) - trasa przekierowuje. */
export function isDisabledLocaleParam(param: string | undefined): boolean {
  const locale = asLocale(param);

  return locale !== undefined && locale !== DEFAULT_LOCALE && !isLocaleEnabled(locale);
}

/** Jezyk z pierwszego segmentu sciezki (`/en/articles/x` = en). */
export function localeFromPath(pathname: string): AppLocale {
  const first = pathname.split('/')[1];

  return first && first !== DEFAULT_LOCALE ? (asLocale(first) ?? DEFAULT_LOCALE) : DEFAULT_LOCALE;
}

/** Sciezka bez prefiksu jezyka (`/en/analiza` = `/analiza`) - w tej postaci buduje ja lib/routes. */
export function delocalizePath(pathname: string): string {
  const locale = localeFromPath(pathname);

  if (locale === DEFAULT_LOCALE) return pathname;

  const rest = pathname.slice(locale.length + 1);

  return rest === '' ? '/' : rest;
}

/** Sciezka (z query i #) w danym jezyku: polski bez prefiksu, inne z `/kod`. Adresy spoza aplikacji bez zmian. */
export function localizePath(path: string, locale: AppLocale): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/api/')) return path;

  const bare = delocalizePath(path);

  if (locale === DEFAULT_LOCALE) return bare;

  return bare === '/' ? `/${locale}` : `/${locale}${bare}`;
}
