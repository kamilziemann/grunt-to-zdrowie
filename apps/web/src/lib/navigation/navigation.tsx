// Nawigacja aplikacji na TanStack Router, swiadoma jezyka w adresie. Adresy buduje lib/routes (bez prefiksu jezyka,
// jedno zrodlo URL-i); tutaj `Link` i hooki dokladaja prefiks biezacego jezyka (`/en/...`), preload danych przy
// najechaniu (loader + Query, zanim uzytkownik kliknie) i zwracaja sciezke BEZ prefiksu do porownan z lib/routes.
import {
  Link as TanstackLink,
  useLocation,
  useNavigate,
  useRouter as useTanstackRouter,
  type RegisteredRouter,
} from '@tanstack/react-router';
import { forwardRef, useMemo, type AnchorHTMLAttributes } from 'react';
import { useLocale } from 'use-intl';

import { delocalizePath, localizePath, type AppLocale } from '../locale';
import type { AppHref } from '../routes';

// Link routera z gotowym `href` (adresy z lib/routes sa napisami, nie literalami tras): szerokie `TTo` zdejmuje
// wymog `to` z typow - adres i tak liczy sie z `href`, a preload, aktywnosc i nawigacja dzialaja jak dla `to`.
const RouterLink = TanstackLink<RegisteredRouter, string, string>;

const EXACT = { exact: true, includeSearch: true } as const;

/** Adres poza stronami aplikacji: inny serwis, poczta, telefon, kotwica na tej stronie albo zasob API. */
export type ExternalHref =
  | `https://${string}`
  | `http://${string}`
  | `mailto:${string}`
  | `tel:${string}`
  | `#${string}`
  | `/api/${string}`;

/** Co przyjmuje Link: adres z lib/routes (typowany wzorcem trasy) albo zewnetrzny - nie dowolny napis. */
export type LinkHref = AppHref | ExternalHref;

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** adres z lib/routes (bez prefiksu jezyka) albo zewnetrzny */
  href: LinkHref;
  /** false = bez preloadu danych (np. linki w dlugich listach) */
  prefetch?: boolean;
  replace?: boolean;
  /** false = bez przewiniecia na gore po przejsciu */
  scroll?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch = true, replace, scroll = true, ...rest },
  ref,
) {
  const locale = useLocale();

  if (EXTERNAL.test(href) || href.startsWith('/api/')) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink
      ref={ref}
      href={localizePath(href, locale)}
      preload={prefetch ? 'intent' : false}
      replace={replace}
      resetScroll={scroll}
      // aktywny (aria-current="page") tylko link do TEJ strony (sciezka + query), nie kazdy przodek adresu -
      // menu i zakladki ustawiaja wlasne `aria-current`, router nie oznacza sekcji na kazdej jej podstronie
      activeOptions={EXACT}
      {...rest}
    >
      {children}
    </RouterLink>
  );
});

/** Biezaca sciezka BEZ prefiksu jezyka (porownania z lib/routes, aktywna pozycja menu). */
export function usePathname(): string {
  return delocalizePath(useLocation({ select: (location) => location.pathname }));
}

export function useSearchParams(): URLSearchParams {
  const searchStr = useLocation({ select: (location) => location.searchStr });

  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

/** Nawigacja z kodu: adresy z lib/routes, prefiks jezyka dokleja hook. `refresh` = ponowne loadery i zapytania trasy. */
export function useRouter() {
  const navigate = useNavigate();
  const router = useTanstackRouter();
  const locale = useLocale();

  return useMemo(
    () => ({
      push: (href: AppHref) => void navigate({ href: localizePath(href, locale) }),
      replace: (href: AppHref) => void navigate({ href: localizePath(href, locale), replace: true }),
      refresh: () => void router.invalidate(),
      back: () => router.history.back(),
    }),
    [navigate, router, locale],
  );
}

/** Ta sama strona w innym jezyku (sciezka, query i #) - dla przelacznikow jezyka i `hreflang`. */
export function useAlternateHref(locale: AppLocale): string {
  const { pathname, searchStr, hash } = useLocation();

  return localizePath(`${delocalizePath(pathname)}${searchStr}${hash ? `#${hash}` : ''}`, locale);
}

export interface LocaleLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'hrefLang'> {
  locale: AppLocale;
}

/** Link do biezacej strony w innym jezyku: nawigacja bez przeladowania, komunikaty laduje layout `{-$locale}`. */
export const LocaleLink = forwardRef<HTMLAnchorElement, LocaleLinkProps>(function LocaleLink(
  { locale, ...rest },
  ref,
) {
  return <RouterLink ref={ref} href={useAlternateHref(locale)} hrefLang={locale} {...rest} />;
});
