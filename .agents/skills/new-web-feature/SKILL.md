---
name: new-web-feature
description: Dodaje nowy ekran/feature w apps/web (TanStack Start w jedynym Workerze) wzorowany na features/parcels i jego trasach - zapytania TanStack Query (queryOptions), mutacje, komponenty, trasa z loaderem, metadanymi i cache brzegowym. Użyj przy "nowa strona", "nowy ekran", "nowy feature w web", "lista/formularz dla X w UI".
---

# Nowy feature w `apps/web` (TanStack Start)

**Najpierw przeczytaj `apps/web/AGENTS.md` – jest nadrzędne wobec tego skilla.** Wzory do skopiowania: feature
`apps/web/src/features/parcels` (zapytania + komponenty + hooki) i jego trasy
`apps/web/src/routes/{-$locale}/_app/index.tsx` (search params, `head`, cache brzegowy strony publicznej przez
`routeCache`) oraz `apps/web/src/routes/{-$locale}/_app/analiza.tsx`. Zakładamy, że API
istnieje (skill `new-server-module`) i typy są w `@app/contracts`. Oficjalne wzorce bibliotek: skille
`tanstack-start`, `tanstack-router-core` (ładowanie danych, search params), `tanstack-router-query`.

## Struktura `src/features/<x>/`

```
api/<x>.queries.ts     queryOptions + klucze `<x>Keys` (jedyne miejsce kluczy i funkcji pobierających)
api/<x>.mutations.ts   funkcje zapisu przez getApi() (albo hooki useMutation w hooks/)
hooks/use-<x>-*.ts     hooki mutacji (useMutation + invalidateQueries po kluczach)
components/<nazwa>/    folder na komponent: <nazwa>.tsx, <nazwa>.test.tsx, index.ts
schemas/               formularze (zod z @app/contracts)
index.ts               publiczne API featura (inne featury i trasy importują tylko stąd)
```

Feature z kilkoma obszarami (np. panel administracyjny) dzieli `api/` na podfoldery obszarów: `api/<obszar>/` z
`<obszar>.queries.ts`, `<obszar>.actions.ts`, testami i `index.ts`, plus `api/shared` (klucze z jednym prefiksem,
wspólne helpery odczytu) i `api/testing` (dublet `getApi` dla testów).

## Kroki

1. **Zapytania** — `api/<x>.queries.ts`:
   ```ts
   export const xKeys = { all: ['x'] as const, detail: (id: string) => ['x', 'detail', id] as const };

   export const xQuery = (id: string) =>
     queryOptions({
       queryKey: xKeys.detail(id),
       queryFn: async (): Promise<X | null> => orNull(getApi().x[':id'].$get({ param: { id } })),
     });
   ```
   `getApi()` z `@/lib/api` działa w SSR (Hono w procesie) i w przeglądarce (`/api`). 404 z API = `null`.
2. **Mutacje** — `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: xKeys.all }) })`.
   Jeśli zmiana jest widoczna na publicznych (cache'owanych) stronach, API musi wyczyścić cache brzegowy: wpis w
   `apps/server/src/entry/routes/cache-rules.ts` (`PURGES`).
3. **Komponenty** — folder na komponent; dane jako propsy albo `useSuspenseQuery(xQuery(id))`; teksty z `use-intl`
   (`useTranslations`, klucze w `messages/pl/<przestrzeń>.json` i `messages/en/...`; nowa przestrzeń = plik w obu + wpis w `src/i18n/namespaces.ts`); linki z `@/lib/navigation` i adresy z `lib/routes`.
4. **Trasa** — `src/routes/{-$locale}/_app/<sciezka>.tsx` (wszystkie strony są publiczne, kont nie ma — ADR 0011):
   ```ts
   export const Route = createFileRoute('/{-$locale}/_app/x/$id')({
     validateSearch: searchSchema,                       // filtry w query string (zod)
     loaderDeps: ({ search }) => search,
     loader: async ({ context: { queryClient }, params }) => {
       const x = await queryClient.query({ ...xQuery(params.id), staleTime: 'static' });
       if (!x) throw notFound();
       return { x };
     },
     headers: routeCache('editorial', (data) => (data ? [cacheTags.x(data.x.id)] : [])), // publiczna strona: polityka + tagi
     head: ({ loaderData, matches }) => pageHead({ title: loaderData?.x.title, locale: headLocale(matches).locale }),
     component: XPage,
   });
   ```
   Adres dopisz w `lib/routes/routes.ts` (bez prefiksu języka). Strona prywatna: bez `headers` (no-store).
5. **Eksport** z `features/<x>/index.ts`; pozycja nawigacji (jeśli potrzebna) w `NAV_ITEMS` (`lib/routes`).
6. **Testy** — komponenty: `renderWithIntl`, `QueryClient` z `setQueryData` (bez sieci); logika: czyste funkcje.
   Przepływ użytkownika: spec Playwright w `apps/web/e2e`.
7. **Weryfikacja** (skill `verify-change`): `bun run dev` → strona w przeglądarce (konsola bez błędów), nagłówki
   `cache-tag` i `cloudflare-cdn-cache-control` na stronie publicznej, potem `bun check`.

## Czego nie robić

- Importów z `next/*`, `next-intl`, dyrektyw `'use client'`/`'use server'` — Start jest izomorficzny.
- Pobierania danych w `useEffect` albo poza `queryOptions`; literałów kluczy Query w komponentach.
- Danych użytkownika w HTML stron publicznych (cache brzegowy jest wspólny) — pobiera je przeglądarka.
- Importu kodu serwera (`@app/server/*` poza typami) — tylko `src/worker.ts`.
