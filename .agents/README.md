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

## Jak dodać skill

1. Utwórz `.agents/skills/<nazwa>/SKILL.md` z frontmatterem `name` i `description` (z frazami wyzwalającymi).
   Zewnętrznych skilli nie trzymamy w repo — instaluj je lokalnie (poza gitem) albo globalnie w swoim narzędziu.
2. Skill projektowy dopisz do tabeli „Skille projektowe” wyżej (sprawdza ją `bun docs:check`).
3. Podlinkuj dla Claude Code: `ln -s ../../.agents/skills/<nazwa> .claude/skills/<nazwa>` (z katalogu `.claude/skills`).
4. Skill projektowy: po polsku, zwięzły (~40–120 linii), z realnymi ścieżkami; nie powtarzaj `AGENTS.md`, tylko
   linkuj do niego. Wyłączone z formatowania i lintu: `.agents/skills/**`.

Inne pliki: `.mcp.json` (serwery MCP: context7, cloudflare docs, shadcn), `.claude/settings.json`
(uprawnienia i hook formatujący `tools/scripts/format-edited-file.sh`).
