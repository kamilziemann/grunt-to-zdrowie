# AGENTS.md — zasady pracy w monorepo

Ten plik opisuje słowami to, co egzekwują narzędzia. Źródłem prawdy są pliki konfiguracyjne:
[`architecture.config.ts`](architecture.config.ts) (granice importów), [`.oxlintrc.json`](.oxlintrc.json) (lint),
[`.oxfmtrc.json`](.oxfmtrc.json) (format), [`commitlint.config.ts`](commitlint.config.ts) (commity),
[`packages/tsconfig`](packages/tsconfig) (TypeScript). Zmieniasz regułę? Zmień konfigurację, potem ten opis.
Szczegóły per obszar: `apps/server/AGENTS.md`, `apps/web/AGENTS.md` — przeczytaj właściwy przed zmianą w aplikacji.
„Dlaczego” stoi w `docs/architecture/` (ADR-y w `decisions/`; lokalnie, poza repo — zob. `.gitignore`). Kod jest źródłem prawdy: jeśli ten plik się z nim
rozjeżdża, popraw plik w tej samej zmianie.

## Jak pracować (ludzie i agenci)

1. **Najpierw czytaj.** Moduł, który zmieniasz, jego sąsiadów i testy; sprawdź, kto importuje plik, który zmieniasz.
   Szukaj istniejącego helpera, zanim napiszesz nowy (`lib/`, `packages/*`).
2. **Większa zmiana = plan.** Nowy obszar, zmiana architektury, migracja danych albo praca na kilka sesji → najpierw
   `docs/plans/<slug>.md` wg `docs/plans/_template.md` (skill `write-plan`). Trwała decyzja → ADR (skill `write-adr`).
3. **Kopiuj wzorzec, nie wymyślaj.** Nowy zasób API = skill `new-server-module` (wzór: `parcels`); nowy ekran = skill
   `new-web-feature` (wzór: `features/parcels`); zmiana schematu = skill `db-change`.
4. **Zweryfikuj** (skill `verify-change`): `bun format`, potem `bun check`; `bun test:e2e` przy zmianach stron;
   `bun db:check` przy zmianach schematu. Nie deklaruj sukcesu bez uruchomienia kontroli; czego nie dało się
   sprawdzić (sekrety, zewnętrzne usługi), napisz wprost.
5. **Nie obchodź narzędzi.** Bez `--no-verify`, bez wyłączania reguł lintu, bez `@ts-ignore`, bez placeholderów
   udających działanie. Naruszenie architektury naprawiasz w kodzie albo świadomie zmieniasz regułę w
   `architecture.config.ts` (i opis tutaj) — nigdy po cichu.
6. **Zostaw ślad.** Każda sesja prowadzi swój plik w `docs/progress` (niżej, skill `progress-log`) i aktualizuje
   go po każdym działającym kroku — także wtedy, gdy nic jeszcze nie jest zacommitowane. Gdy zmienia się zakres,
   kończy etap albo zapada decyzja, popraw też `docs/project-status.md`.

Skille (przepisy) są w `.agents/skills/` (`.claude/skills` to symlinki), opis w [`.agents/README.md`](.agents/README.md).
Skill nigdy nie jest ważniejszy od tego pliku.

## Zanim oddasz zmianę

```bash
bun check          # format:check → lint → architecture:check → docs:check → check:types → test
bun test:e2e       # gdy zmieniasz strony (apps/web); @visual tylko na macOS (baseline'y), gdzie indziej pomijany
```

oxfmt zawsze przez `tools/scripts/oxfmt.mjs` (skrypty, lefthook, hook Claude Code): na macOS/Linuksie to zwykły oxfmt,
a na Windowsie z włączonym Smart App Control (blokuje natywny plik oxfmt) ta sama wersja rusza w WSL. Wymaga WSL z bun
albo node; `OXFMT_VIA_WSL=1` wymusza WSL, `OXFMT_VIA_WSL=0` lokalną binarkę.

Pre-commit (lefthook) najpierw poprawia staged pliki (oxfmt, potem autofix `arch/padding-lines`), potem uruchamia
oxlint i `architecture:check`; commit-msg sprawdza commitlint. `bun format` robi to samo na całym repo.

## Dziennik postępu (`docs/progress`)

Każda sesja prowadzi własny plik `docs/progress/RRRR-MM-DD/<krótka-nazwa>-<id>.md` (`<id>` = unikalny
dopisek, np. początek id sesji): **Stan teraz**, **Zrobione** (z hashami commitów, a przed commitem z dopiskiem
„bez commita”), **Następny krok**. Aktualizuj go po każdym działającym kroku i przed zakończeniem tury, tak żeby
inny model mógł podjąć pracę bez czytania rozmowy; rzeczy niesprawdzone nazywaj wprost. Zasady:
`docs/progress/README.md`.

Obraz całości — co budujemy, co działa, plan dalej, decyzje i ryzyka — stoi w
`docs/project-status.md`. Przeczytaj go na początku sesji; zmieniasz zakres, kończysz etap
albo podejmujesz decyzję → popraw go w tej samej zmianie (trwałe decyzje dodatkowo jako ADR).

## Reguły architektury (= reguły `bun architecture:check`)

Identyfikatory w nawiasach to reguły checkera (`--only <id>`); naruszenia pokazują plik, linię i powód.

1. **Graf paczek jest jawny i acykliczny** (`package-deps`). Paczka `packages/<x>` importuje tylko paczki wymienione
   w `packages['@app/x'].allowed`. Nowa paczka = wpis w `architecture.config.ts` (bez niego checker zgłosi
   „niezadeklarowana”). Narzędzia (`tools/*`) mogą importować paczki; paczki nie importują narzędzi.
2. **Paczki i narzędzia nie znają aplikacji** (`no-app-import`). Zależność idzie tylko `apps → packages`.
   Typ aplikacji serwera trafia do klienta przez `import type { AppType } from '@app/server/types'`
   w `apps/web`, nigdy w `packages/rpc` ani `packages/start-kit` (kit dostaje fabrykę klienta od aplikacji).
3. **Publiczne API paczek** (`deep-import`). `@app/x/<subpath>` tylko gdy subpath jest w `exports` jej
   `package.json` albo w `deepImports.allowSubpaths` (np. `@app/http/hono`, `@app/env/server`,
   `@app/db/schema`). Import względny nie wychodzi poza własną paczkę/aplikację.
4. **Bez cykli importów** (`cycles`). Liczą się importy statyczne, re-eksporty i `require`; `import type`
   i `import()` nie tworzą krawędzi. Każda silnie spójna składowa jest raportowana raz, z pełną ścieżką.
5. **Warstwy `apps/server`** (`layers`, `forbidden-modules`):

   | warstwa          | katalog                 | może importować                                              | nie zna                                                              |
   | ---------------- | ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
   | `root`           | `src/*.ts`              | wszystko                                                     |                                                                      |
   | `entry`          | `src/entry/**`          | modules, services, repositories, infrastructure, domain, lib |                                                                      |
   | `modules`        | `src/modules/**`        | services, domain, lib                                        | `drizzle-orm`, `@app/db`                                             |
   | `services`       | `src/services/**`       | repositories, domain, lib                                    | `hono`, `@hono/*`, `drizzle-orm`, `@app/db`, `@app/http/hono`        |
   | `repositories`   | `src/repositories/**`   | domain, lib                                                  |                                                                      |
   | `infrastructure` | `src/infrastructure/**` | domain, lib                                                  |                                                                      |
   | `domain`         | `src/domain/**`         | tylko siebie                                                 | `hono`, `@hono/*`, `drizzle-orm`, `@app/db`, `@app/http`, `@app/env` |
   | `lib`            | `src/lib/**`            | tylko siebie                                                 | `hono`, `@hono/*`, `drizzle-orm`, `@app/db`                          |

   Warstwa pliku to pierwszy pasujący glob. Zakazane moduły obowiązują także dla `import type` — warstwa ma ich
   nie znać w ogóle (serwisy znają tylko porty z `domain`/`services/*/ports.ts`).

6. **Rodzeństwo nie zagląda sobie do środka** (`siblings`):
   - `apps/server/src/modules/<a>` nie importuje `modules/<b>` w ogóle;
   - `apps/server/src/services/<a>` importuje `services/<b>` tylko przez `services/<b>/index.ts`;
   - `apps/web/src/features/<a>` importuje `features/<b>` tylko przez `features/<b>/index.ts` (to jest reguła
     „feature-imports”; plugin oxlint `arch/no-cross-feature-import` zgłasza to samo w edytorze).
     Pliki spoza tych katalogów (np. `src/routes/**`, `src/entry/**`) nie podlegają tej regule — trasa składa
     strony z publicznych API kilku featurów.
7. **Między aplikacjami tylko typy** (`type-only`). Dozwolone pary są w `typeOnlyImports` (dziś: `web → server`)
   i wyłącznie jako `import type`; `import()`/`require` nigdy. Inne pary = naruszenie. Jedyny świadomy wyjątek
   (`runtime` pary): wejście jedynego Workera (`apps/web/src/worker.ts`, `src/entry/**`) importuje
   `@app/server/worker` (fetch Hono, cron; kolejki i klasy Workflow, gdy je dodasz) — żaden inny plik `apps/web` nie zna kodu serwera.
8. **Importy dynamiczne tylko tam, gdzie mają sens** (`dynamic-import`): `apps/web/src/**`,
   `apps/server/src/infrastructure/**` (`dynamicImports.allow`).
9. **Katalogi wspólne nie znają featurów** (`server-client`). `src/components/ui/**`, `src/components/shared/**`
   i `src/lib/**` w `apps/web` nie importują `src/features/**` (również typów). Kodu „tylko serwerowego” w stronach
   nie ma: TanStack Start jest izomorficzny, dane idą przez API (`getApi()`), a serwer zna tylko wejście Workera.
10. **Folder na jednostkę** (`folder-units`). W katalogach z `folderUnits.dirs` (m.in. `apps/server/src/{domain,lib,
    infrastructure}`, `apps/web/src/components/*`, `apps/web/src/lib/**`, `apps/web/src/features/*/components`,
    `tools/*/src`) każda funkcja, komponent albo moduł ma własny folder `<nazwa>/`: `<nazwa>.ts(x)`, `<nazwa>.test.ts(x)`,
    pomocniki tylko tej jednostki i `index.ts` z publicznym API (`export * from './<nazwa>'`). Naruszenia: plik (także
    test) leżący luzem w takim katalogu poza `allowRootFiles` (`index.ts`) oraz import spoza folderu jednostki do jej
    prywatnego pliku (`../iso-date/iso-date`; ma być `../iso-date`). Katalog z listy leżący w innym katalogu
    z listy (`lib/utils` w `lib`) jest grupą, a jednostkami są jego podfoldery. Poza regułą zostają `src/routes/**`
    (konwencje TanStack Router) oraz `services/*`, `modules/*`, `repositories/*` (już po jednym folderze na obszar).

## Konwencje kodu

- TypeScript strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`: `import type` dla typów, bez `any`, bez
  `@ts-ignore` (`@ts-expect-error` tylko z opisem), bez `!` (non-null assertion) poza testami.
- Nazwy plików kebab-case (`job-state.ts`, `jobs.service.ts`); wyjątki z konwencji TanStack Router: `$param.tsx`,
  `__root.tsx`, `_layout/`, `{-$locale}/`, generowany `routeTree.gen.ts`; oraz `README.md`, `AGENTS.md`.
  Identyfikatory po angielsku, komentarze i komunikaty dla ludzi po polsku.
- Formatowanie: oxfmt (110 znaków, pojedyncze cudzysłowy, przecinki końcowe). Lint: oxlint `--type-aware`,
  zero ostrzeżeń (`--deny-warnings`). `console.log` tylko w `tools/**`, skryptach i konfiguracjach.
- Puste linie w listach instrukcji (reguła `arch/padding-lines`, z autofixem): przed `return`/`throw` (chyba że to
  pierwsza instrukcja bloku), po serii `const`/`let`/`var` oraz przed i po wieloliniowych blokach (`if`/`for`/`while`/
  `switch`/`try`, funkcje, klasy, interfejsy, typy, enumy); jednolinijkowe `if (!x) return;` nie wymagają odstępów.
  Pusta linia idzie przed komentarzem prowadzącym instrukcję. Oxfmt pustych linii nie dodaje, więc `bun format` =
  oxfmt + `bun format:padding` (`.oxlintrc.padding.json`, tylko ta reguła); brak odstępów łamie `format:check` i lint.
  Hook Claude Code (`.claude/settings.json` → `tools/scripts/format-edited-file.sh`) robi to po każdej edycji.

  ```ts
  export async function get(id: string): Promise<Parcel> {
    const parcel = await source.byId(id);
    const fallback = null;

    if (!parcel) throw AppError.notFound('Parcel', id);

    if (parcel.areaHa === 0) {
      log.warn('empty geometry');

      return fallback ?? parcel;
    }

    return parcel;
  }
  ```

- Pierwsza linia pliku: komentarz, po co plik istnieje i jakie ma granice (moduły, konfiguracja, dane, logika).
  Plik jednego komponentu, hooka albo strony może zamiast tego mieć JSDoc nad eksportem. Komentarze mówią
  „dlaczego”, nie „co”.
- Błędy: w kodzie serwera tylko `AppError` z `@app/http` (kod z `PROBLEM_CODES`), transport zamienia je na Problem
  Details; w stronach `RpcError` z `@app/rpc` mapowany na komunikaty przez `code`.
- Kontrakty (schematy Zod, typy DTO) żyją w `packages/contracts`; API i strony ich nie duplikują.
- Zmienne środowiska wyłącznie przez `@app/env` (walidacja Zod); sekrety nigdy w `vars`/bundlu.
- Testy obok kodu (`*.test.ts` w folderze jednostki, zob. reguła `folder-units`), integracyjne API w
  `apps/server/test`, E2E w `apps/web/e2e`.
- Commity: Conventional Commits z zakresem z listy `web server contracts db env http rpc logger config tools docs
  ci deps release`, np. `feat(server): kolejka renderów`, `fix(web): obsługa 503 w formularzu`.

## Gdzie dodać…

- **endpoint API** → `apps/server/src/modules/<obszar>` (trasy + OpenAPI) wołający serwis z `src/services/<obszar>`;
  DTO i kody błędów w `packages/contracts`. Patrz `apps/server/AGENTS.md`.
- **tabelę / kolumnę** → `packages/db/src/schema.ts` → `bun db:generate` → `bun db:migrate`; typy JSON z kontraktów.
- **stronę** → feature `apps/web/src/features/<obszar>` (`api/<obszar>.queries.ts`, `components/`, `hooks/`,
  `schemas/`, `index.ts`) i trasa w `src/routes/{-$locale}/...` (loader + `head` + `headers` cache). Patrz
  `apps/web/AGENTS.md` i skill `new-web-feature`.
- **cache strony albo odczytu API** → polityka i tagi z `@app/cache` (`packages/cache`): trasa `headers: routeCache(...)`,
  API — wpis w `apps/server/src/entry/routes/cache-rules.ts`; mutacja, która zmienia to, co widzi anonimowy odczyt,
  dostaje tam purge tagów. Domyślnie wszystko jest `private, no-store`.
- **usługę Cloudflare (R2, KV, Queue, Workflow, DO, Cron)** → binding w `apps/web/wrangler.jsonc` (jedyny Worker, każde `env`),
  typ w `packages/env/src/server.ts`, adapter w `apps/server/src/infrastructure/<nazwa>`, złożenie w
  `src/container.ts`; wejścia w `src/entry/<rodzaj>` (README w każdym katalogu).
- **zmienną środowiska / sekret** → schemat w `packages/env` (`serverVarsSchema`), wartość w `apps/web/wrangler.jsonc` `vars` albo `apps/web/.dev.vars.example` + `wrangler secret put`.
- **raportowanie błędów (Sentry)** → włącz `SENTRY_ENABLED` + sekret `SENTRY_DSN` (adapter jest w
  `apps/server/src/infrastructure/sentry`); logi i ślady daje Cloudflare Observability bez konfiguracji
  (`docs/architecture/deployment.md`). Logi pisz loggerem z kontekstu (`c.get('logger')`), nigdy `console.log`.
- **paczkę opcjonalną** (emails, storage, payments) → dopiero gdy projekt jej potrzebuje: `packages/<nazwa>`,
  wpis w `architecture.config.ts`, zakres w `commitlint.config.ts`.
- **konta / ochronę endpointu** → nie ma: aplikacja jest bez kont (ADR 0011),
  API jest publiczne. Funkcja przypisana do osoby = najpierw nowy ADR.
- **nową funkcję, komponent albo moduł w katalogu jednostek** (lista wyżej, reguła 10) → nowy folder
  `<katalog>/<nazwa>/` z `<nazwa>.ts(x)`, testem i `index.ts`; importujesz folder, nie plik w środku.
  Nowy katalog jednostek = wpis w `folderUnits.dirs` w `architecture.config.ts`.
- **zależność między paczkami** → `package.json` (`workspace:*`) **i** `architecture.config.ts` (`allowed`);
  nowy subpath → `exports` w `package.json` (i ewentualnie `deepImports.allowSubpaths`).
- **regułę architektury** → `architecture.config.ts` (typy w `tools/architecture-check/src/config/config.ts`), test na
  fixtures w `tools/architecture-check/test/fixtures`, opis tutaj.
