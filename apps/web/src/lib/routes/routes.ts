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
   * i odswiezyc). `raport` = zapisany raport (krotki link, bez ponownego liczenia).
   */
  report: (search?: FieldSearch & { dzialki?: string; uprawa?: string; data?: string; raport?: string }) =>
    withQuery(routePath('/raport'), {
      raport: search?.raport,
      dzialki: search?.dzialki,
      obszar: search?.obszar,
      rodzaj: search?.rodzaj,
      uprawa: search?.uprawa,
      data: search?.data,
    }),
  /** Gospodarstwo: kazda dzialka analizowana osobno, tabela "gdzie dzialac najpierw" (I2). */
  farm: (search?: { dzialki?: string; uprawa?: string; data?: string }) =>
    withQuery(routePath('/gospodarstwo'), {
      dzialki: search?.dzialki,
      uprawa: search?.uprawa,
      data: search?.data,
    }),
  /** Ekran wyboru dzialek z gotowa lista (powrot z podsumowania). */
  parcels: (parcelIds?: string) => withQuery(routePath('/'), { dzialki: parcelIds }),
  /** "Jak liczymy": zrodla danych, metody, ograniczenia (dla jury, doradcy i rolnika). */
  method: () => routePath('/jak-liczymy'),
  /** Katalog systemu designu (tylko development). */
  design: () => routePath('/design'),
} as const;

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
