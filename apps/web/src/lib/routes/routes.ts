// Adresy stron aplikacji - jedyne miejsce, w ktorym powstaja URL-e (linki, formularze, router.push). Kazda sciezka
// idzie przez `routePath` ze wzorca trasy, wiec usuniecie albo zmiana nazwy trasy psuje `check:types`, nie linki.
import { routePath, withQuery, type AppHref } from './route-path';

/** Wlasny obszar w adresie (D3): zwarty zapis obrysu (`lib/field-geometry`) i rodzaj pola. */
export interface FieldSearch {
  obszar?: string;
  rodzaj?: 'part' | 'drawn';
}

export const routes = {
  home: () => routePath('/'),
  /**
   * Podsumowanie dzialek i formularz analizy; `parcelIds` trafia do parametru `dzialki`, a `form` (powrot z raportu)
   * wypelnia wczesniej wybrana uprawe i dzien.
   */
  analysis: (parcelIds?: string, form?: FieldSearch & { uprawa?: string; data?: string }) =>
    withQuery(routePath('/analiza'), {
      dzialki: parcelIds,
      obszar: form?.obszar,
      rodzaj: form?.rodzaj,
      uprawa: form?.uprawa,
      data: form?.data,
    }),
  /**
   * Raport wodny: dzialki (albo wlasny obszar), uprawa i dzien analizy w adresie (link do raportu da sie wyslac
   * i odswiezyc).
   */
  report: (search?: FieldSearch & { dzialki?: string; uprawa?: string; data?: string }) =>
    withQuery(routePath('/raport'), {
      dzialki: search?.dzialki,
      obszar: search?.obszar,
      rodzaj: search?.rodzaj,
      uprawa: search?.uprawa,
      data: search?.data,
    }),
  /** Ekran wyboru dzialek z gotowa lista (powrot z podsumowania). */
  parcels: (parcelIds?: string) => withQuery(routePath('/'), { dzialki: parcelIds }),
  /** Logowanie; `next` = strona, na ktora wrocic po zalogowaniu (tylko sciezka tej aplikacji, zob. `safeNextPath`). */
  signIn: (next?: string) => withQuery(routePath('/sign-in'), { next: safeNextPath(next) ?? undefined }),
  signUp: () => routePath('/sign-up'),
  account: () => routePath('/account'),
  /** Katalog systemu designu (tylko development). */
  design: () => routePath('/design'),
} as const;

const LOCAL_ORIGIN = 'https://app.invalid';

/**
 * Adres powrotu po logowaniu (`?next=`): tylko sciezka tej aplikacji (`/account?tab=a`). Pelny URL, `//host`
 * albo `/\host` (przegladarka czyta je jako inny host) = null, zeby link logowania nie przekierowal na obca strone.
 */
export function safeNextPath(value: string | null | undefined): AppHref | null {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;

  try {
    const url = new URL(value, LOCAL_ORIGIN);

    // sprawdzona sciezka tej samej aplikacji (z ?next=), wiec bezpieczna jako adres linku i nawigacji
    return url.origin === LOCAL_ORIGIN ? (`${url.pathname}${url.search}${url.hash}` as AppHref) : null;
  } catch {
    return null;
  }
}

/** Klucze etykiet nawigacji: przestrzen `nav` w messages/*.json (AppNav tlumaczy je typowanym `t`). */
export type NavLabelKey = 'design';

export interface NavItem {
  href: AppHref;
  labelKey: NavLabelKey;
  /** pozycja tylko w development (strony deweloperskie - poza dev to 404) */
  devOnly?: boolean;
}

/** Pozycje nawigacji glownej (strona glowna = logo). Nowa funkcja = nowa pozycja tutaj + klucz w `nav`. */
export const NAV_ITEMS: readonly NavItem[] = [{ href: routes.design(), labelKey: 'design', devOnly: true }];

/** Sekcja jest aktywna na swojej stronie i na podstronach (`/design/x` = Design system). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Element sciezki nad naglowkiem strony (`Breadcrumbs`); brak `href` = biezaca strona. */
export interface Crumb {
  label: string;
  href?: AppHref;
}
