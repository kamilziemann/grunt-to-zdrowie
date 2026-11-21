// Sciezki budowane ze wzorcow tras TanStack Router: wzorzec (`/analiza`, `/pola/$id`) jest typem z wygenerowanego drzewa tras
// (routeTree.gen.ts), wiec literowka, usunieta trasa albo zla nazwa parametru to blad `check:types`, a nie martwy
// link na produkcji. Prefiks jezyka (`{-$locale}`) dokleja Link z lib/navigation. Wynik ma typ `AppHref` - Link
// przyjmuje tylko takie adresy (albo zewnetrzne), wiec napis wpisany recznie w komponencie tez nie przejdzie typow.
import type { FileRoutesByFullPath } from '@/routeTree.gen';

type WithoutLocale<P> = P extends `/{-$locale}${infer Rest}` ? Rest : never;

type Normalized<P extends string> = P extends '' | '/' ? '/' : P extends `${infer Rest}/` ? Rest : P;

/** Wzorce tras aplikacji bez prefiksu jezyka (`/`, `/analiza`); bez trasy-splat 404. */
export type RoutePattern = Exclude<Normalized<WithoutLocale<keyof FileRoutesByFullPath>>, '/$'>;

/** Nazwy parametrow wzorca (`/a/$x/$y` -> 'x' | 'y'). */
export type RouteParamName<P extends string> = P extends `${string}$${infer Name}/${infer Rest}`
  ? Name | RouteParamName<`/${Rest}`>
  : P extends `${string}$${infer Name}`
    ? Name
    : never;

type ParamsArg<P extends string> = [RouteParamName<P>] extends [never]
  ? []
  : [params: Record<RouteParamName<P>, string | number>];

/** Adres strony aplikacji zbudowany z wzorca trasy (tylko z `routePath` i pomocnikow ponizej). */
export type AppHref = string & { readonly __appHref: true };

/** Sciezka ze wzorca trasy; wartosci parametrow kodowane (`a/b` -> `a%2Fb`). */
export function routePath<P extends RoutePattern>(pattern: P, ...[params]: ParamsArg<P>): AppHref {
  if (!params) return pattern as AppHref;

  const values: Record<string, string | number> = params;

  return pattern.replace(/\$([A-Za-z]+)/g, (_match, name: string) =>
    encodeURIComponent(String(values[name] ?? '')),
  ) as AppHref;
}

/** Adres z parametrami zapytania; puste wartosci pomijane (czysty adres bez `?status=`). */
export function withQuery(href: AppHref, query?: Record<string, string | undefined>): AppHref {
  const [path = '', search = ''] = href.split('?');
  const params = new URLSearchParams(search);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') params.delete(key);
    else params.set(key, value);
  }

  const queryString = params.toString();

  return (queryString ? `${path}?${queryString}` : path) as AppHref;
}

/** Adres z kotwica (`/account#sesje`). */
export function withHash(href: AppHref, hash: string): AppHref {
  return `${href.split('#')[0]}#${hash}` as AppHref;
}
