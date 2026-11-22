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
   * i odswiezyc). `raport` = zapisany raport (krotki link, bez ponownego liczenia); `widok: 'szczegoly'` otwiera
   * widok szczegolowy (link dla doradcy).
   */
  report: (
    search?: FieldSearch & {
      dzialki?: string;
      uprawa?: string;
      data?: string;
      raport?: string;
      widok?: 'szczegoly';
    },
  ) =>
    withQuery(routePath('/raport'), {
      raport: search?.raport,
      dzialki: search?.dzialki,
      obszar: search?.obszar,
      rodzaj: search?.rodzaj,
      uprawa: search?.uprawa,
      data: search?.data,
      widok: search?.widok,
    }),
  /** Gospodarstwo: kazda dzialka analizowana osobno, tabela "gdzie dzialac najpierw" (I2). */
  farm: (search?: { dzialki?: string; uprawa?: string; data?: string }) =>
    withQuery(routePath('/gospodarstwo'), {
      dzialki: search?.dzialki,
      uprawa: search?.uprawa,
      data: search?.data,
    }),
  /** Ekran mapy z gotowa lista dzialek (powrot z podsumowania i z raportu). */
  parcels: (parcelIds?: string) => withQuery(routePath('/mapa'), { dzialki: parcelIds }),
  /**
   * Ekran mapy: `dzialki` = lista "moje dzialki", `widok` = prostokat do pokazania (adres ze strony glownej),
   * `rysuj` = od razu tryb wlasnego pola (`podziel` jedyna dzialke linia albo `rysuj` obrys).
   */
  map: (search?: { dzialki?: string; widok?: string; rysuj?: 'podziel' | 'rysuj' }) =>
    withQuery(routePath('/mapa'), { dzialki: search?.dzialki, widok: search?.widok, rysuj: search?.rysuj }),
  /** "Jak liczymy": zrodla danych, metody, ograniczenia (dla jury, doradcy i rolnika). */
  method: () => routePath('/jak-liczymy'),
} as const;

/** Klucze etykiet nawigacji: przestrzen `nav` w messages/*.json (AppNav tlumaczy je typowanym `t`). */
export type NavLabelKey = 'map' | 'method';

export interface NavItem {
  href: AppHref;
  labelKey: NavLabelKey;
  /** pozycja tylko w development (strony deweloperskie - poza dev to 404) */
  devOnly?: boolean;
}

/** Pozycje nawigacji glownej (strona glowna = logo). Nowa funkcja = nowa pozycja tutaj + klucz w `nav`. */
export const NAV_ITEMS: readonly NavItem[] = [
  // mapa dzialek z menu (przeglad telefonu: bez niej mape otwieral tylko przycisk na stronie glownej)
  { href: routes.map(), labelKey: 'map' },
  { href: routes.method(), labelKey: 'method' },
];

/** Sekcja jest aktywna na swojej stronie i na podstronach (`/jak-liczymy/x` = Jak liczymy). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Element sciezki nad naglowkiem strony (`Breadcrumbs`); brak `href` = biezaca strona. */
export interface Crumb {
  label: string;
  href?: AppHref;
}
