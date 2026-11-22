# .agents

Katalog dla agentów AI. `.agents/skills/<nazwa>/SKILL.md` to jedyne miejsce, gdzie leżą skille; narzędzia widzą
je przez symlinki (`.claude/skills/<nazwa>` → `../../.agents/skills/<nazwa>`).

## Zasada nadrzędna

**`AGENTS.md` (root i per obszar) jest źródłem prawdy** o regułach pracy w repo; konfiguracje (`architecture.config.ts`,
`.oxlintrc.json`, ...) są egzekucją. Skille to **przepisy** (jak coś zrobić krok po kroku) i nie mogą im
przeczyć. Znalazłeś sprzeczność? Popraw skill (albo, jeśli to reguła, konfigurację, potem `AGENTS.md`).

## Skille projektowe (nasze)

| Skill                | Cel                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------- |
| `new-server-module`  | nowy zasób API end-to-end (kontrakt → db → repo → serwis → moduł → kontener → test) |
| `new-web-feature`    | nowy feature w `apps/web` wzorowany na `features/parcels`                           |
| `db-change`          | zmiana schematu D1/Drizzle: `db:generate` → `db:migrate` → `db:check`               |
| `progress-log`       | dziennik sesji w `docs/progress`                                                    |
| `write-plan`         | plan w `docs/plans` przed większą pracą                                             |
| `write-adr`          | decyzja architektoniczna w `docs/architecture/decisions`                            |
| `verify-change`      | lista kontrolna "gotowe": format, check, e2e, db:check                              |
| `architecture-rules` | ściąga po regułach `bun architecture:check` i naprawach naruszeń                    |
| `design-system`      | tokeny designu, komponenty ui, motyw, wybór kierunku stylu                          |

## Skille TanStack (oficjalne, z paczek npm)

Oficjalne skille TanStack (mechanizm **TanStack Intent**) są częścią paczek npm `@tanstack/*` w wersji, której używa
`apps/web` - nie kopiujemy ich: `.agents/skills/tanstack-*` to linki do `apps/web/node_modules/@tanstack/<paczka>/skills`,
więc aktualizują się razem z zależnościami (po `bun install`; bez instalacji linki są puste). Przejrzane pod kątem
bezpieczeństwa (10.2026): sama dokumentacja i przykłady kodu, bez skryptów wykonywanych przez agenta.

| Skill                        | Paczka                                  | Cel                                                        |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `tanstack-start`             | `@tanstack/react-start`                 | TanStack Start: konfiguracja, trasy, server functions, SSR |
| `tanstack-start-core`        | `@tanstack/start-client-core`           | model wykonania (izomorfizm), middleware, server routes    |
| `tanstack-start-server-core` | `@tanstack/start-server-core`           | serwer Start: handler, kontekst zapytania                  |
| `tanstack-router`            | `@tanstack/react-router`                | React Router TanStack: linki, hooki, komponenty            |
| `tanstack-router-core`       | `@tanstack/router-core`                 | ładowanie danych, parametry, search params, SSR, błędy     |
| `tanstack-router-query`      | `@tanstack/react-router` (compositions) | Router + TanStack Query: QueryClient per zapytanie, SSR    |

## Skille zewnętrzne (vendored)

Skopiowane do repo (nie pobierane w locie). Wpisy śledzone w `skills-lock.json`: `cloudflare`,
`workers-best-practices`, `wrangler`, `durable-objects`, `web-perf`, `caveman`, `sentry-cloudflare-sdk`.

| Skill                         | Cel                                               |
| ----------------------------- | ------------------------------------------------- |
| `cloudflare`                  | wybór produktów Cloudflare, architektura          |
| `workers-best-practices`      | dobre praktyki Cloudflare Workers                 |
| `wrangler`                    | CLI i konfiguracja Wranglera                      |
| `durable-objects`             | Durable Objects                                   |
| `agents-sdk`                  | Cloudflare Agents SDK (vendored manually)         |
| `hono`                        | framework Hono (vendored manually)                |
| `turborepo`                   | Turborepo (vendored manually)                     |
| `vercel-composition-patterns` | wzorce kompozycji komponentów (vendored manually) |
| `web-design-guidelines`       | przegląd UI wg wytycznych (vendored manually)     |
| `web-perf`                    | audyt wydajności i Core Web Vitals                |
| `caveman`                     | tryb ultra-zwięzłych odpowiedzi                   |
| `sentry-cloudflare-sdk`       | Sentry w Workerze (włączanie, opcje)              |

### Vendored manually

Skopiowane z innego repo, bez wpisu w `skills-lock.json` (brak śledzenia aktualizacji): `agents-sdk`, `hono`,
`turborepo`, `vercel-composition-patterns`, `web-design-guidelines`.

## Skille design, motion i tekstu (vendored manually)

Skopiowane z publicznych repo (licencja MIT, plik `LICENSE` w każdym folderze), przejrzane pod kątem bezpieczeństwa
przed dodaniem. Aktualizacja: sklonuj repo źródłowe i podmień folder (commit źródła poniżej).

| Skill                          | Źródło (commit)                    | Kiedy                                                                       |
| ------------------------------ | ---------------------------------- | --------------------------------------------------------------------------- |
| `humanizer`                    | `blader/humanizer` (`8c307f3`)     | tekst „brzmi jak AI” (README, copy, maile); wzorce głównie dla angielskiego |
| `design-taste-frontend`        | `Leonxlnx/taste-skill` (`f624f37`) | kierunek artystyczny strony marketingowej/landingu (nie dashboard)          |
| `redesign-existing-projects`   | `Leonxlnx/taste-skill`             | audyt i podniesienie jakości istniejącego UI bez psucia funkcji             |
| `minimalist-ui`                | `Leonxlnx/taste-skill`             | styl: edytorialny minimalizm                                                |
| `high-end-visual-design`       | `Leonxlnx/taste-skill`             | styl: „agencja premium” (miękkie cienie, karty, blur)                       |
| `industrial-brutalist-ui`      | `Leonxlnx/taste-skill`             | styl: brutalizm/Swiss/terminal (dashboardy z danymi)                        |
| `emil-design-eng`              | `emilkowalski/skills` (`2d22863`)  | filozofia dopracowania UI i komponentów (Emil Kowalski)                     |
| `animate`                      | `emilkowalski/skills`              | budowa animacji od zera (czy, po co, czym, krzywa, czas, przerwanie)        |
| `animation-performance`        | `emilkowalski/skills`              | animacje w budżecie klatki, diagnoza gubienia klatek                        |
| `find-animation-opportunities` | `emilkowalski/skills`              | gdzie ruch pomoże (tylko propozycje)                                        |
| `improve-animations`           | `emilkowalski/skills`              | audyt ruchu + plany do wykonania                                            |
| `review-animations`            | `emilkowalski/skills`              | review kodu animacji (tylko na wywołanie)                                   |
| `animation-vocabulary`         | `emilkowalski/skills`              | „jak się nazywa ten efekt?”                                                 |
| `apple-design`                 | `emilkowalski/skills`              | gesty, sprężyny, arkusze, materiały — styl Apple na webie                   |
| `mobile-native`                | `emilkowalski/skills`              | web app, który na telefonie czuje się natywnie                              |
| `break-ui`                     | `emilkowalski/skills`              | test UI na danych z najgorszego przypadku                                   |
| `pick-ui-library`              | `emilkowalski/skills`              | wybór biblioteki do zadania (tylko na wywołanie)                            |
| `prototype`                    | `emilkowalski/skills`              | kilka wersji UI z przełącznikiem do porównania (tylko na wywołanie)         |

Zasady użycia w tym repo:

- **Jeden kierunek stylu na projekt.** `design-taste-frontend`, `minimalist-ui`, `high-end-visual-design` i
  `industrial-brutalist-ui` wzajemnie się wykluczają (np. brutalist wymaga monospace, taste go zakazuje). Wybrany
  kierunek zapisz w ADR i usuń pozostałe (folder + symlink), żeby agent nie mieszał stylów.
- Skille stylu mają mocne opinie (zakazy fontów, gradientów, ikon) — `AGENTS.md`, `apps/web/AGENTS.md` i komponenty
  `components/ui` są ważniejsze; nową zależność (biblioteka animacji, fonty) dodajesz świadomie.
- `design-taste-frontend` ma skrypty Node (`scripts/`): `assets.mjs` szuka i pobiera zdjęcia z publicznych API
  (Openverse, Wikimedia, Art Institute of Chicago, Met, Internet Archive, NASA), `inspect.mjs` uruchamia headless
  Chrome na localhost, `draw.mjs` zapisuje `.taste-skill/` w repo i historię w `~/.taste-skill/history.json`. Wyjścia
  (`.taste-skill/`, `/assets/`) są w `.gitignore`; zdjęcia, które zostają, przenieś do `apps/web/public` z
  `credits.json`. Generowane strony odwołują się do Google Fonts / Fontshare — przy wymogu „bez zewnętrznych CDN”
  hostuj fonty lokalnie (`@fontsource-variable/*` importowane w `src/styles/app.css`).
- `improve-animations` zapisuje plany w `plans/` w korzeniu — w tym repo plany leżą w `docs/plans/` (przenieś albo
  wskaż ścieżkę przy wywołaniu). `prototype` tworzy tymczasową trasę `/prototypes/<slug>` (u nas plik w
  `apps/web/src/routes/{-$locale}/_app/_dev/`) — usuń ją po wyborze wersji (skill sam to robi), nie commituj jej.
- Skille Emila na start odpowiadają krótko („I'm ready to…”) i czekają na pytanie — to zamierzone.
- `humanizer` zakazuje półpauz i myślników; w dokumentacji po polsku obowiązuje styl repo, nie ten zakaz.

## Jak dodać skill

1. **Z rejestru/GitHuba**: `npx skills add <repo>` (np. `cloudflare/skills`) – narzędzie pobiera skill do
   `.agents/skills/` i dopisuje wpis do `skills-lock.json`.
2. **Ręcznie** (własny albo skopiowany): utwórz `.agents/skills/<nazwa>/SKILL.md` z frontmatterem `name` i
   `description` (z frazami wyzwalającymi). Skopiowany z zewnątrz: dopisz wpis do `skills-lock.json` albo
   wymień go w sekcji "Vendored manually" powyżej.
3. Podlinkuj dla Claude Code: `ln -s ../../.agents/skills/<nazwa> .claude/skills/<nazwa>` (z katalogu `.claude/skills`).
4. Skill projektowy: po polsku, zwięzły (~40–120 linii), z realnymi ścieżkami; nie powtarzaj `AGENTS.md`, tylko
   linkuj do niego. Wyłączone z formatowania i lintu: `.agents/skills/**` (kod zewnętrzny).

Inne pliki: `.mcp.json` (serwery MCP: context7, cloudflare docs, shadcn), `.claude/settings.json`
(uprawnienia i hook formatujący `tools/scripts/format-edited-file.sh`).
