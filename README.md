# Grunt to Zdrowie

Aplikacja dla rolnika na zadanie KOWR „Zatrzymaj wodę, chroń plony” (HackNation 2026). Rolnik wskazuje działkę
ewidencyjną (numer albo mapa), wybiera uprawę i datę, a aplikacja **oblicza** raport o sytuacji wodnej: ocena →
przyczyny → retencja → agrotechnika → ewentualne nawadnianie, ze źródłami danych, datami i ograniczeniami.

Stan prac, plan i decyzje: [`docs/project-status.md`](docs/project-status.md).

## Co już działa

- **Wybór działek** (`/`): mapa na cały ekran, jedno pole wyszukiwania (pełny numer działki, „obręb numer” albo adres),
  kliknięcie w mapę, warstwa granic i numerów działek, podkład mapa / zdjęcie lotnicze, lista „moje działki” w adresie
  strony. Działa na telefonie (arkusz od dołu).
- **Podsumowanie** (`/analiza`): wybrane działki przed analizą.
- **API analizy** (`POST /api/analysis`): pole + uprawa + data → raport w docelowym kształcie. Dane wejściowe i
  obliczenia są na razie **przykładowe** (`meta.sample: true`); prawdziwe źródła i metody (KBW wg IUNG, bilans FAO-56)
  wchodzą pakietami z planu [`docs/plans/silnik-analizy-i-raport.md`](docs/plans/silnik-analizy-i-raport.md).

## Źródła danych

| Dane                                 | Źródło                                      | Licencja / uwagi                          |
| ------------------------------------ | ------------------------------------------- | ----------------------------------------- |
| Działka po numerze i pod punktem     | ULDK GUGiK                                  | dane publiczne; limit zapytań na adres IP |
| Granice i numery działek, zapas ULDK | zbiorcza usługa WFS ewidencji gruntów GUGiK | dane publiczne                            |
| Zdjęcie lotnicze                     | ortofotomapa GUGiK (WMS)                    | dane publiczne, wymagane podanie źródła   |
| Podkład mapy                         | OpenFreeMap „liberty” (dane OpenStreetMap)  | ODbL, bez klucza                          |
| Adresy i miejscowości                | Nominatim (OpenStreetMap)                   | ODbL, ok. 1 zapytanie/s                   |

Źródła silnika analizy (pogoda, gleba, teren, wody, satelity) i ich stan weryfikacji: [`docs/research/`](docs/research/README.md).

## Technologia

- **Jeden Worker Cloudflare** (`apps/web`): strony TanStack Start (React 19, SSR) i API Hono pod `/api`
  ([ADR 0008](docs/architecture/decisions/0008-tanstack-start-single-worker.md)); mapa na MapLibre GL
  ([ADR 0009](docs/architecture/decisions/0009-field-style-and-maplibre.md)).
- **API** (`apps/server`): Hono + OpenAPI + Zod, warstwy entry → modules → services → repositories/domain, zewnętrzne
  usługi za portami (adaptery w `infrastructure/`), błędy jako Problem Details (RFC 9457).
- **Kontrakty** (`packages/contracts`): jedne schematy Zod dla API i stron.
- **Jakość**: TypeScript strict, oxlint (zero ostrzeżeń), oxfmt, `bun architecture:check` (granice importów),
  `bun docs:check`, Vitest (API w workerd, komponenty w jsdom), Playwright + axe.

## Wymagania

- **Bun** w wersji z [`.bun-version`](.bun-version) — zależności i skrypty.
- **Node 24** — `wrangler`, `vite` i `vitest` biegną pod Node.
- **Cloudflare** tylko do wdrożenia: `bunx wrangler login` (lokalnie `vite dev` w workerd działa bez konta).

## Uruchomienie

```bash
bun install                                              # zależności + hooki gita (lefthook)
cp apps/web/.dev.vars.example apps/web/.dev.vars         # lokalne sekrety Workera (żaden nie jest wymagany)
bun run setup:local                                      # lokalna baza D1: migracje
bun run dev                                              # jeden serwer: strony + API (vite dev w workerd)
```

- Aplikacja: <http://localhost:3000>
- API: <http://localhost:3000/api> (OpenAPI: <http://localhost:3000/api/docs>, <http://localhost:3000/api/openapi.json>)

## Komendy

| Komenda                        | Co robi                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `bun dev`                      | `vite dev` w `apps/web` (:3000): strony + API pod `/api` + D1 w workerd                           |
| `bun run build`                | `turbo run build` (bez `run` Bun uruchomi własny bundler)                                         |
| `bun check`                    | po kolei: `format:check` → `lint` → `architecture:check` → `docs:check` → `check:types` → `test`  |
| `bun format`                   | oxfmt + autofix pustych linii                                                                     |
| `bun run test`                 | vitest w każdej paczce (API w workerd, komponenty w jsdom)                                        |
| `bun test:e2e`                 | Playwright (`apps/web/e2e`) na `vite dev` (strony + API, świeża lokalna D1)                       |
| `bun architecture:check`       | reguły z [`architecture.config.ts`](architecture.config.ts) (warstwy, graf paczek, cykle, …)      |
| `bun db:generate` / `db:check` | migracja SQL ze schematu `packages/db/src/schema.ts` / zgodność migracji ze schematem             |
| `bun db:migrate`               | migracje na lokalnej D1                                                                           |
| `bun run deploy`               | `tools/scripts/deploy.ts`: zasoby, migracje D1, build i deploy jedynego Workera (`--env preview`) |

## Struktura

```
apps/
  server/               API: Hono + OpenAPI; warstwy entry/modules/services/repositories/infrastructure/domain
  web/                  jedyny Worker: TanStack Start (trasy src/routes, features) + API z server pod /api
packages/
  auth/                 opcjonalne konta (Better Auth), domyślnie wyłączone
  cache/                polityki i tagi cache brzegowego (Workers Cache)
  config/               stałe wspólne (nazwa, paginacja)
  contracts/            schematy Zod + typy: działki, miejsca, uprawy, analiza, raport, kody błędów
  db/                   schemat Drizzle (D1), migracje SQL
  env/                  walidowane zmienne środowiska Workera i typy bindingów
  http/                 AppError + Problem Details + adapter Hono
  logger/               logger JSON-lines
  rpc/                  typowany klient API
  start-kit/            klocki TanStack Start niezależne od domeny (klient izomorficzny, cache tras, SEO, motyw)
  tsconfig/             presety TypeScript
tools/                  checker architektury, zgodność dokumentacji z kodem, reguły oxlint, skrypty (deploy, oxfmt)
docs/
  project-status.md     co budujemy, co działa, plan, decyzje, ryzyka
  hackathon/            treść zadania KOWR
  plans/                plany etapów
  research/             notatki o źródłach danych i metodyce
  architecture/         opis architektury i decyzje (ADR)
  progress/             dziennik sesji pracy
```

## Środowisko i sekrety

- `apps/web/.dev.vars.example` → `.dev.vars` obok niego (w `.gitignore`): sekrety Workera do `vite dev`. Zmienne
  niesekretne (`PUBLIC_URL`, CORS, `LOG_LEVEL`) są w `apps/web/wrangler.jsonc` → `vars`. Walidacja:
  `packages/env/src/server.ts`.
- Opcjonalne: konta (`AUTH_ENABLED` + `AUTH_SECRET`, [docs/architecture/auth.md](docs/architecture/auth.md)), Sentry
  (`SENTRY_ENABLED` + `SENTRY_DSN`), Postgres z PostGIS na Neon (`DATABASE_URL`, konfiguracja w `neon.ts`).
- Produkcja: `wrangler secret put NAZWA --env production` w `apps/web`.

## Wdrożenie

`bun run deploy` (migracje D1 → build → deploy jedynego Workera) albo GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Pierwsza konfiguracja konta:
[docs/architecture/deployment.md](docs/architecture/deployment.md).

## Ograniczenia

- Raport z `POST /api/analysis` liczony jest dziś na danych przykładowych — nie nadaje się jeszcze do decyzji na polu.
- Usługi GUGiK, OpenFreeMap i Nominatim nie mają gwarancji dostępności i limitują ruch; aplikacja ma zapasowe źródło
  działek (WFS) i cache, ale szukanie po „obręb numer” zależy wyłącznie od ULDK.
- Powierzchnia działki jest liczona z geometrii i może różnić się od ewidencyjnej.

## Zasady pracy w repo

[`AGENTS.md`](AGENTS.md) (wiążące dla ludzi i agentów AI): granice importów, kontrakty, konwencje kodu, plan przed
większą zmianą (`docs/plans`), dziennik sesji (`docs/progress`), trwałe decyzje jako ADR. Przegląd architektury:
[docs/architecture/overview.md](docs/architecture/overview.md).
