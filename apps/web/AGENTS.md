# apps/web (`@app/web`) – jedyny Worker: strony (TanStack Start) + API (Hono) + zadania w tle

Strony aplikacji na **TanStack Start** (React 19, SSR, routing plikowy) w **jednym Workerze Cloudflare** razem z API
Hono z `apps/server` (montowane pod `/api`) i cronem. Przed Workerem stoi **Workers Cache**: publiczne strony
i odczyty API idą z brzegu z tagami, mutacje czyszczą tagi. Komentarze po polsku (bez diakrytyków), teksty UI
w `messages/{pl,en}/*.json` (use-intl), identyfikatory po angielsku, pliki w kebab-case. Decyzja o jednym Workerze:
[ADR 0008](../../docs/architecture/decisions/0008-tanstack-start-single-worker.md).

## Struktura

```
src/
  worker.ts             wejście Workera: /api/* -> Hono (apps/server), reszta -> Start; scheduled
  entry/                kod tylko dla wejścia Workera (granica /api, zapytanie o stronę: requestId, ślad, log `page`)
  router.tsx            fabryka routera: QueryClient PER ZAPYTANIE, SSR Query, preload `intent`, domyślne 404/błąd
  routes/               trasy plikowe TanStack Router (cienkie: loader + head + headers + kompozycja komponentów)
    __root.tsx          dokument HTML (shellComponent), <head>, skrypt motywu, raportowanie błędów, dostawcy
    {-$locale}/         jezyk w adresie: `/` = pl, `/en/...` = en; loader komunikatów, IntlProvider
      _app/             powłoka aplikacji (nawigacja, menu konta, 404): strona główna, logowanie, `_protected/` (konto)
        _dev/           sekcja deweloperska (katalog /design) - tylko development, własne komunikaty `dev`
  features/<x>/         api/ (*.queries.ts, *.mutations.ts, *.actions.ts), components/, hooks/, schemas/, utils/, index.ts
                        api/ obejmujące kilka obszarów → podfoldery obszarów (`api/<obszar>/<obszar>.queries.ts`,
                        testy, `index.ts`) + `api/shared`. Małe featury (wzór: `features/parcels`) zostają płaskie.
  components/ui|shared  prymitywy i komponenty wspólne (bez wiedzy o featurach), folder na komponent
  lib/                  api (klient API), navigation (Link, hooki), locale, routes (adresy), seo, telemetry, theme,
                        problems, query (klucze, health), rpc (typ AppType, parsowanie)
  i18n/                 ładowanie komunikatów (load-messages), przestrzenie sekcji (client-messages)
  styles/app.css        tokeny designu (ADR 0007), Tailwind 4
  test/                 dubel nawigacji, render z i18n, straznik tokenow designu
messages/               pl/ i en/: plik na przestrzeń (pl = źródło typów); język włączasz w `lib/locale` ENABLED_LOCALES
e2e/                    Playwright na `vite dev` (jeden serwer: strony + API)
```

## Jak działa zapytanie

1. **Workers Cache** (`wrangler.jsonc` → `cache.enabled`): GET z ważnym wpisem wraca z brzegu bez uruchamiania Workera.
   Klucz = ścieżka + query, **bez ciasteczek** — dlatego HTML nie może zależeć od ciasteczek (język w adresie, motyw
   ustawia skrypt w `<head>`, stan konta pobiera przeglądarka z `/api/me`).
2. `src/worker.ts`: `/api/*` → Hono (prefiks odcięty), reszta → `handlePageRequest` (requestId, ślad W3C, log `page`,
   domyślne `private, no-store`) → TanStack Start.
3. Trasa: `loader` zapełnia cache TanStack Query przez **izomorficzny klient** `getApi()` (`@/lib/api`): na serwerze
   Hono w tym samym Workerze (bez sieci, z sesją, IP i śladem bieżącego zapytania), w przeglądarce `fetch('/api')`.
4. Komponent czyta dane `useSuspenseQuery` (ten sam klucz) — dane z SSR jadą do przeglądarki (dehydracja), przy
   nawigacji loader działa w przeglądarce, a preload `intent` pobiera dane już przy najechaniu na link.

## Wzorzec trasy

```tsx
export const Route = createFileRoute('/{-$locale}/_app/posts/$id')({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const post = await queryClient.query({ ...postQuery(id), staleTime: 'static' }); // krytyczne: czekamy
    if (!post) throw notFound();                                           // 404 w powłoce `_app`
    void queryClient.query(recentQuery).catch(noop);                       // poboczne: bez czekania
    return { post };                                                       // tylko to, czego potrzebuje head
  },
  headers: routeCache('editorial', (data) => [cacheTags.page(data?.post.id ?? '')]),
  head: ({ loaderData, matches, params }) =>
    pageHead({ title: loaderData?.post.title, locale: headLocale(matches).locale, path: routes.post(params.id) }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQuery(id));
  ...
}
```

- **Dane** tylko przez `queryOptions` z `features/<x>/api/<x>.queries.ts` (klucze w obiekcie `<x>Keys`, `queryFn` przez
  `getApi()` + `unwrap`). Szczegół: `unwrapOrNull` (`@app/rpc`) — 404 API = `null` → trasa rzuca `notFound()` (404 w
  powłoce `_app`); inny błąd leci do `RouteError` (`@/components/shared/route-error`). Strona z kilkoma niezależnymi sekcjami: loader `query(...).catch(noop)`,
  komponent `useQuery` per sekcja z `ProblemAlert` i `RetryButton` (`@/components/shared`; sekcja pada osobno, ponawia
  tylko swoje zapytanie). Loadery używają `queryClient.query` (TanStack Query 5.10x): `{ ...opcje, staleTime: 'static' }` zamiast
  `ensureQueryData`, `.catch(noop)` zamiast `prefetchQuery` — stare metody są oznaczone jako przestarzałe, a lint
  (`typescript/no-deprecated`) je odrzuca.
- **Search params**: zwykłe query stringi (router: `parsePlainSearch`/`stringifyPlainSearch` z `@app/start-kit`);
  `validateSearch` parsuje schematem z `@app/contracts`, `loaderDeps: ({ search }) => search`. Liczby z adresu
  przychodzą jako `number` — schematy zamieniają je na tekst.
- **Mutacje**: `useMutation` (albo akcja formularza `(prev, formData) => ActionState` dla `useActionState`) wołająca
  `getApi()`; po sukcesie `queryClient.invalidateQueries({ queryKey: <x>Keys.all })` i/lub `router.invalidate()`.
  Cache brzegowy czyści API (purge po mutacjach — `apps/server/src/entry/routes/cache-rules.ts`).
- **Cache strony**: `headers: routeCache(polityka, tagi)` z `@app/start-kit` i `@app/cache` (`editorial` dla treści
  czyszczonych przy zapisie, `publicData` dla danych odświeżanych w tle, `static`, `private` dla danych użytkownika). Bez `headers` strona jest
  `private, no-store`. Tagi = dane, z których powstała strona (te same tagi ma API, purge czyści oba).
- **Metadane**: `head` + `pageHead` (`@/lib/seo`); tytuły z komunikatów przez `headTranslator(matches, 'przestrzeń')`.
- **Strony prywatne** (konto): `ssr: false` albo dane prywatne tylko w przeglądarce; ochrona w `beforeLoad`
  (`resolveAuthState`), API i tak autoryzuje każde zapytanie.
- **Linki**: `Link`, `usePathname`, `useSearchParams`, `useRouter` z `@/lib/navigation` (nie z `@tanstack/react-router`
  wprost) i adresy z `lib/routes` (bez prefiksu języka — `Link` dokleja `/en`). Przełącznik języka: `LocaleLink`.
  Każdy adres w `lib/routes` powstaje przez `routePath('/analiza')` — wzorzec jest typem z drzewa tras,
  więc usunięta trasa albo literówka to błąd `check:types`. `Link` i `useRouter().push` przyjmują tylko `AppHref`
  (z `lib/routes`, `withQuery`, `withHash`) albo adres zewnętrzny/`#kotwica`/`/api/...` — napis wpisany ręcznie nie
  przejdzie typów.
  Formularz GET (filtry, szukajka): `action={localizePath(routes.x(), useAppLocale())}` z `@/lib/locale`.
- **Błędy przeglądarki** trafiają do `/api/telemetry/errors` (globalnie z `__root`, z granic błędów `reportClientError`)
  z traceId odsłony — tym samym, co nagłówki `traceparent` zapytań API (Cloudflare Observability łączy ścieżkę).

## Reguły architektury (`bun run architecture:check`)

- Między featurami tylko przez `features/<x>/index.ts`; `components/ui|shared` i `lib` nie importują featurów.
- `src/worker.ts` i `src/entry/**` to jedyne miejsca, które importują kod serwera (`@app/server/worker`) i
  `@app/start-kit/worker` (część start-kit bez DOM — projekt TS Workera nie ma typów przeglądarki); reszta
  aplikacji zna serwer tylko przez `import type { AppType }` (`lib/rpc/app-type`) i HTTP.
- Folder na jednostkę w `components/*`, `lib/**`, `features/*/components`, `entry` (`<nazwa>/<nazwa>.ts(x)`, test, `index.ts`).
- `package.json` ma `"sideEffects": ["**/*.css"]`: moduły nie mają efektów przy imporcie, więc bundler wycina
  nieużywane eksporty barrelów (`features/<x>/index.ts`) — bez tego cały feature trafia do JS każdej strony.
  Import tylko dla efektu (poza CSS) musi być dopisany do tej listy.

## Komendy (z `apps/web`)

| Komenda                   | Co robi                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `bun run dev`             | `vite dev` na :3000 w workerd: strony + API + D1 (lokalny stan `.wrangler/state`)                              |
| `bun run build`           | build Workera i plików klienta (`dist/`)                                                                       |
| `bun run check:js-budget` | budżet JS stron publicznych na buildzie (gzip na stronę, limit w `scripts/check-js-budget.ts`); CI po buildzie |
| `bun run preview`         | build produkcyjny w workerd                                                                                    |
| `bun run db:migrate`      | migracje lokalnej D1 (z `packages/db/migrations`)                                                              |
| `bun run check:types`     | dwa projekty TS: przeglądarka/SSR (`tsconfig.json`) i Worker (`tsconfig.worker.json`)                          |
| `bun run test`            | Vitest (jsdom) — komponenty, logika, narzędzia                                                                 |
| `bun run test:e2e`        | Playwright na `vite dev`                                                                                       |
| `bun run deploy`          | `tools/scripts/deploy.ts`: migracje D1 i deploy jedynego Workera                                               |

## Testy komponentów

Vitest + Testing Library; `renderWithIntl` z `@/test/render-intl`. `@/lib/navigation` jest globalnie podmieniony
dublem (`src/test/navigation-double.tsx`: `Link` = `<a>`), test sprawdzający nawigację nadpisuje wybrane hooki.
Komponenty z zapytaniami dostają `QueryClient` z danymi ustawionymi `setQueryData` (bez sieci).
