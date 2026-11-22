# AGENTS.md: `@app/server`

API: Hono + `@hono/zod-openapi` (zod 4), D1 przez Drizzle (`@app/db`), plus cron (kolejki i Workflow - przepis niżej).
**Własnego Workera nie ma**: wejścia (`src/index.ts`) eksportuje `@app/server/worker`, a montuje je jedyny Worker
`apps/web` (`src/worker.ts`: `/api/*` → Hono z odciętym prefiksem, `scheduled`;
ADR 0008). Konfiguracja Workera
(bindingi, `vars`, środowiska) jest w [`../web/wrangler.jsonc`](../web/wrangler.jsonc). Lokalnie API działa pod
<http://localhost:3000/api> (`bun run dev` z korzenia). Wzorcowy obszar:
`parcels` (moduł, serwis, porty w domenie, adaptery zewnętrznych usług, testy jednostkowe i integracyjne) - kopiuj go
przy nowym zasobie (skill `new-server-module`). Zasady całego monorepo: [`../../AGENTS.md`](../../AGENTS.md).

## Warstwy (wiążące, egzekwuje je `bun run architecture:check`)

Źródło prawdy: [`../../architecture.config.ts`](../../architecture.config.ts) (sekcja `apps['@app/server']`). Zmieniasz zasady tylko tam.

| Warstwa (`src/…`) | Może importować                                     | Zakazane                                                                             |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `entry/`          | modules, services, repositories, infra, domain, lib | -                                                                                    |
| `modules/`        | services, domain, lib                               | `drizzle-orm`, `@app/db`, repozytoria, **inne moduły**                               |
| `services/`       | repositories, domain, lib                           | `hono`, `@hono/*`, `drizzle-orm`, `@app/db`; inny serwis tylko przez jego `index.ts` |
| `repositories/`   | domain, lib                                         | -                                                                                    |
| `infrastructure/` | domain, lib                                         | -                                                                                    |
| `domain/`         | nic                                                 | `hono`, drizzle, `@app/db`, `@app/http`, `@app/env`                                  |
| `lib/`            | nic                                                 | `hono`, `@hono/*`, drizzle, `@app/db`                                                |
| `src/*.ts` (root) | wszystko                                            | -                                                                                    |

Zależności serwisów od świata zewnętrznego to **porty** (interfejsy w `services/*/ports.ts`); implementacje (D1, a po dodaniu: R2, kolejka, zewnętrzne API) powstają w `repositories/` i `infrastructure/`, a łączy je `src/container.ts`. Testy (`*.test.ts`, `test/**`) są poza regułami warstw.

**Folder na jednostkę** (reguła `folder-units`): w `domain/`, `lib/` i `infrastructure/` każda funkcja, port albo adapter ma własny folder `<nazwa>/` z `<nazwa>.ts`, `<nazwa>.test.ts`, pomocnikami tylko tej jednostki i `index.ts` (`export * from './<nazwa>'`), np. `domain/iso-date/{iso-date.ts,iso-date.test.ts,index.ts}`. Importujesz folder (`../../domain/note-title`), nigdy plik w środku (`…/note-title/note-title`); plik luzem w tych katalogach jest naruszeniem. Test obejmujący kilka jednostek leży przy tej, którą sprawdza najmocniej. `services/<obszar>` i `modules/<obszar>` już mają po folderze na obszar (reguła `siblings`).

## Przepływ requestu

`entry/app.ts` (middleware: request-id → logger → env → CORS → kontener) → reguły cache (`entry/routes/cache-rules.ts`) w `entry/routes/index.ts` → **moduł** (`modules/<nazwa>`) → **handler** → **serwis** (`c.get('container').<serwis>`) → **repozytorium** (Drizzle) lub **infrastruktura**.

- Moduł = cienka warstwa HTTP: `*.schemas.ts` (DTO zod), `*.routes.ts` (`createRoute`), `*.handlers.ts` (`RouteHandler<typeof route, AppEnv>`), `index.ts` (`new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(route, handler)`). Handler tylko wyciąga zwalidowane dane (`c.req.valid(...)`), woła serwis i zwraca `c.json(...)`.
- Serwis = logika aplikacji, rzuca `AppError` (`@app/http`); `entry/app.ts` zamienia błędy na `application/problem+json` (RFC 9457). Serwis nie zna HTTP ani Drizzle.
- Repozytorium = zapytania Drizzle, mapowanie wiersz → DTO z `@app/contracts`.
- Typ aplikacji dla stron: `src/types.ts` (`AppType`), importowany jako `import type … from '@app/server/types'`. `apps/web` kompiluje źródła serwera **własnymi** opcjami (lib DOM, typy `Request`/`Response` inne niż z workers-types), więc w typach tras nie przekazuj `Request`/`Response` z Cloudflare, tylko zwykłe dane. Sprawdzenie: `(cd ../web && bun run check:types | grep "\.\./server")` nie może nic wypisać.
- Telemetria przeglądarki: `src/modules/telemetry` (`POST /telemetry/errors`, czyli `/api/telemetry/errors`) przyjmuje raporty błędów JS stron (`installClientErrorReporter` z `@app/start-kit`) i loguje je z traceId odsłony.

## Jak dodać moduł / endpoint (krok po kroku)

1. **Kontrakt** (jeśli to nowy typ danych): schemat zod w `packages/contracts` (nie tu).
2. **Tabela / zapytania** (jeśli potrzebne): schemat i migracja w `packages/db` (`bun run db:generate`), potem `src/repositories/<nazwa>/<nazwa>.repository.ts` (`createXRepository(db: Db)`).
3. **Port + serwis**: `src/services/<nazwa>/ports.ts` (interfejsy zależności), `<nazwa>.service.ts` (`createXService(deps)`), `index.ts` (publiczne API serwisu; inne serwisy importują tylko stąd). Dopisz serwis do interfejsu `Container` w `src/services/container/index.ts`.
4. **Kompozycja**: w `src/container.ts` zbuduj repozytorium/infrastrukturę i serwis, zwróć go w kontenerze (i dodaj ewentualny override do `ContainerOverrides` dla testów).
5. **Moduł HTTP**: `src/modules/<nazwa>/{x.schemas,x.routes,x.handlers}.ts` + `index.ts` (wzór: `modules/parcels`). Odpowiedzi opisuj pomocnikami z `lib/openapi` (`jsonResponse`, `jsonBody`, `notFound`, `validationFailed`).
6. **Montaż**: `.route('/<ścieżka>', xModule)` w `src/entry/routes/index.ts` (jeden łańcuch wywołań, żeby `AppType` zawierał wszystkie trasy).
7. **Testy**: jednostkowy serwisu obok pliku (`x.service.test.ts`, z fakami) i integracyjny w `test/integration/<nazwa>.test.ts`.
8. `bun run check:types`, `bun run test`, `bun run lint` i `bun run architecture:check` (z korzenia) muszą być zielone.

### Reguła OpenAPI: `.meta()`, nigdy `.openapi()`

Schematy z `@app/contracts` są tworzone zwykłym `zod`, a `.openapi()` na schemacie istnieje tylko dzięki łataniu prototypu, które `@hono/zod-openapi` robi na _własnej_ kopii zoda (pod Vitestem kopie CJS/ESM się rozjeżdżają: `idParamSchema.openapi is not a function`). Dlatego **nie wołaj `.openapi(...)` na schematach**; używaj natywnych metadanych zod 4, które czyta `@asteasolutions/zod-to-openapi`:

- `schema.meta({ id: 'Parcel' })`: nazwany komponent w `components.schemas` (`id` → refId),
- `schema.meta({ param: { name: 'id', in: 'path' } })`: parametr ścieżki/zapytania,
- `schema.meta({ description: '…' })`, `schema.meta({ example: … })`, `schema.meta({ format: 'binary' })`.

`.meta()` zwraca **nowy** schemat: przypisz wynik (`export const parcelDto = parcelSchema.meta({ id: 'Parcel' })`). Zostaw tylko `.openapi(route, handler)` na instancji `OpenAPIHono` (to metoda Hono, nie schematu). `z`, `createRoute` i `OpenAPIHono` importuj z `@hono/zod-openapi`. Test `health.test.ts` pilnuje, że `/openapi.json` ma nazwane DTO w `components.schemas` i parametry ścieżek.

## Cache brzegowy (Workers Cache)

Przed Workerem stoi Workers Cache (klucz = ścieżka + query, bez ciasteczek). Mapa w jednym miejscu:
[`src/entry/routes/cache-rules.ts`](src/entry/routes/cache-rules.ts), middleware w `src/entry/middlewares/edge-cache.ts`:

- `privateByDefault`: odpowiedź bez polityki dostaje `private, no-store` (inaczej Workers Cache trzymałby GET 2 h),
- `PUBLIC_READS`: publiczne odczyty z polityką (`editorial`, `publicData`) i tagami z `@app/cache` — **nowy publiczny
  endpoint odczytu, który ma iść z brzegu, wymaga wpisu tutaj** (bez wpisu jest prywatny, co jest bezpieczne, ale
  każde wejście liczy Worker),
- `PURGES`: prefiksy mutacji → tagi do wyczyszczenia po udanej odpowiedzi (`purgeOnWrite`, zanim odpowiemy) —
  **nowa mutacja, która zmienia to, co widzi anonimowy odczyt, wymaga wpisu tutaj**, inaczej strona zostanie nieaktualna do
  końca TTL.
- Cron: kroki (`STEPS` w `src/entry/cron/scheduled.ts`) zmieniające dane publiczne zwracają tagi, a tick robi jeden
  purge ich sumy. **Nowy krok crona, który zmienia to, co widzi anonimowy odczyt, zwraca swoje tagi.** Workflow to osobny
  entrypoint i nie czyści cache.

Port czyszczenia `EdgeCachePurger` leży w `src/domain/edge-cache`, adapter na `cache.purge({ tags })` w
`src/infrastructure/edge-cache` (bez Workers Cache w runtime, np. w testach, loguje pominięcie). Purge działa tylko w
entrypoincie z cache (fetch, cron, kolejka) — zmiany z Workflow odświeża TTL `publicData`. Te same tagi ustawiają
trasy stron (`apps/web`, `routeCache`), więc purge czyści i API, i strony.

## DI: kontener (`src/container.ts`)

`createContainer({ env, vars, logger, waitUntil }, overrides?)` buduje na każdy request (i każdą wiadomość kolejki, wywołanie Workflow, uruchomienie crona - gdy je dodasz) repozytoria → infrastrukturę → serwisy. Zero I/O na poziomie modułu, zero singletonów zależnych od środowiska. Kontrakt (`Container`, `ContainerDeps`, `AppEnv`) leży w `services/container`, bo importują go i `modules` (handlery), i `entry` (middleware). `src/index.ts` wstrzykuje `createContainer` do `createApp()`. Testy podmieniają infrastrukturę przez `ContainerOverrides` (`now` - stały zegar, `edgeCache` - purger zapamiętujący wywołania), bez dotykania serwisów; każdy nowy adapter dostaje tu swoje pole.

## Usługi Cloudflare (R2, KV, Queues, Workflows, Durable Objects, Cron)

Aplikacja używa dziś tylko D1 i crona (krok `heartbeat`). Nowa usługa: binding w `apps/web/wrangler.jsonc` (**każde** `env`, bindingi się nie dziedziczą) → typ w `ServerBindings` i `pickBindings` (`packages/env/src/server.ts`) → port w `services/<obszar>/ports.ts` → adapter w `infrastructure/<nazwa>/` (folder na jednostkę) → złożenie w `src/container.ts` (+ override dla testów). Wejścia (konsument kolejki, cron, klasy Workflows i DO) w `src/entry/<rodzaj>/` i eksport z `src/index.ts`; nową klasę Workflow/DO eksportuje też `apps/web/src/worker.ts` - kroki w README tych katalogów. Bez bindingu (lokalnie, testy) adapter ma ścieżkę inline albo zgłasza `AppError.notConfigured(...)`.

## Logi, ślady i Sentry

Loguj wyłącznie loggerem z kontekstu (`c.get('logger')` w handlerach, `deps.logger` w serwisach): każda linia ma
`requestId`, `traceId` i `spanId` (z `traceparent` strony: SSR przenosi ślad w procesie, przeglądarka w nagłówku),
więc w Cloudflare Observability łączy się z logiem strony i błędami przeglądarki (moduł `telemetry`). Sentry (`src/infrastructure/sentry`) jest domyślnie wyłączony (`SENTRY_ENABLED`, sekret `SENTRY_DSN`);
dostaje tylko błędy 5xx przez `reportError` w `createApp`. Szczegóły: `docs/architecture/deployment.md`.

## Env i bindingi

Bindingi (`apps/web/wrangler.jsonc`): `DB` (D1, migracje z `../../packages/db/migrations`) i `triggers.crons`. Zmienne nie-sekretne są w `vars` (nie dziedziczą się między `env.preview`/`env.production`: każde środowisko ma pełną kopię). Sekrety lokalnie: `.dev.vars` w `apps/web` (wzór: [`../web/.dev.vars.example`](../web/.dev.vars.example), plik jest w `.gitignore`), w chmurze: `wrangler secret put` w `apps/web`. Walidacja: `packages/env/src/server.ts` (`serverVarsSchema`, `optionalSecret` dla opcjonalnych kluczy). Zła konfiguracja = HTTP `503 not_configured` z listą pól.

## Bez kont

Aplikacja nie ma kont użytkowników (ADR 0011): API jest publiczne, nie ma sesji, tożsamości w kontekście ani ról. Nie dodawaj strażników tras ani parametru tożsamości w serwisach bez nowego ADR.

## Testy

- Jednostkowe: `src/**/*.test.ts` obok serwisów (fałszywki portów w pamięci, wzór: `services/analysis/analysis.service.test.ts`), domeny i `lib/`.
- Integracyjne: `test/integration/*.test.ts`. Cały zestaw działa w workerd (`@cloudflare/vitest-plugin`, `vitest.config.ts`) z lokalnym D1 i migracjami z `packages/db` (`test/apply-migrations.ts`). `test/helpers.ts`: `makeApp(overrides, extraEnv)` składa prawdziwą aplikację z prawdziwym kontenerem; `json(body, method)` buduje request.
- Testy są deterministyczne: stały zegar (`ContainerOverrides.now`), pola referencyjne z `test/fixtures/reference-fields.ts`; nigdy prawdziwe zewnętrzne API.
- Lint pilnuje m.in. braku `expect` w warunkach (`vitest/no-conditional-expect`): zamiast `if (x) expect(...)` porównuj całe obiekty albo zbieraj problemy do tablicy.

## Komendy

Serwer dev i deploy należą do jedynego Workera: `bun run dev` (z korzenia albo `apps/web`: `vite dev` na :3000, API pod
<http://localhost:3000/api>, `/api/docs` = Scalar, `/api/openapi.json`), `bun run deploy` (`tools/scripts/deploy.ts`),
migracje `bun db:migrate` (z korzenia; wrangler z `apps/web`). Skrypty w `scripts/` wołają `wrangler d1 execute` z
katalogu Workera (`WORKER_DIR` = `apps/web`, `scripts/worker-dir.ts`), więc trafiają do tej samej lokalnej bazy,
którą czyta strona; skrypty mówiące do API domyślnie używają `http://localhost:3000/api`.

Z `apps/server` (jeśli nie napisano inaczej):

| Komenda                                               | Co robi                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `bun run test` / `test:watch`                         | Vitest w workerd (bindingi z `apps/web/wrangler.jsonc`) |
| `bun run check:types`                                 | `tsc` dla `src`/`test` i dla `scripts`                  |
| `bun run lint`, `bun run architecture:check` (korzeń) | oxlint (`--type-aware --deny-warnings`) i reguły warstw |

Pierwszy start lokalny (z korzenia): `cp apps/web/.dev.vars.example apps/web/.dev.vars && bun run setup:local && bun run dev` (`setup:local` = migracje lokalnej D1). Pierwszy deploy: `bun run deploy` z roota zakłada bazę D1 i wpisuje jej id tylko w `env.production`/`env.preview` w `apps/web/wrangler.jsonc` (`database_id` top-level to klucz lokalnej bazy `vite dev` - nie zmieniaj go).

## Konwencje

TS strict, bez `any` i `ts-ignore`, `import type` dla typów, pliki w kebab-case, komentarze po polsku, identyfikatory po angielsku, `detail` błędów po angielsku (komunikaty UI mapuje `apps/web` z `code`). Nie wyłączaj reguł lintu: napraw kod (np. wyczerpujący `switch` bez `default` zastąp `default` na ostatnim wariancie, żeby zachować zawężenie typu).
