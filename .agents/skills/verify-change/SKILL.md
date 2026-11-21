---
name: verify-change
description: Lista kontrolna "zanim oddasz zmianę" - format, lint, architektura, typy, testy, e2e, db:check. Użyj przed commitem/PR, przy "sprawdź", "zweryfikuj", "czy to działa", "gotowe?" i zawsze na koniec pracy.
---

# Weryfikacja zmiany

Źródło: sekcja "Zanim oddasz zmianę" w `AGENTS.md`. Uruchamiaj z roota repo.

## Kolejność

1. `bun format` – oxfmt na całym repo + autofix reguły `padding-lines` (puste linie).
2. `bun check` = `format:check` → `lint` (oxlint `--type-aware --deny-warnings`) → `architecture:check` →
   `docs:check` → `check:types` → `test`. Zero błędów i zero ostrzeżeń.
3. `bun test:e2e` – gdy zmieniałeś `apps/web` (Playwright na prawdziwym API i lokalnej D1).
4. `bun db:check` – gdy zmieniałeś `packages/db/src/schema.ts` lub migracje (skill `db-change`).
5. Zmiana UI: uruchom aplikację (`bun dev`: jeden serwer :3000 — strony i API pod `/api`) i sprawdź w przeglądarce
   główny przepływ (konsola bez błędów; na stronach publicznych nagłówki `cache-tag` i `cloudflare-cdn-cache-control`).

Szybsze pętle w trakcie pracy: `bun lint:fast`, `bun x oxlint --type-aware --deny-warnings <ścieżka>`,
`bun run --cwd apps/server test`, `bun run --cwd apps/web test`, `bun architecture:check`.

## Czego nie wolno

- `git commit --no-verify`, pomijać lefthook/commitlint, `SKIP=...` – hooki to część definicji "gotowe".
- Wyłączać reguł lint (`// oxlint-disable`, zmiany w `.oxlintrc.json`), luzować `architecture.config.ts`,
  `@ts-ignore`, `any`, `!` ani osłabiać testów, żeby przeszły. Napraw przyczynę; zmiana reguły to osobna,
  świadoma decyzja (skill `architecture-rules`, `write-adr`).
- Usuwać lub osłabiać testów, które padają, bez zrozumienia dlaczego.

## Raportowanie

Napisz **uczciwie**, co uruchomiono i z jakim wynikiem, a czego nie (np. "e2e nie uruchomione: brak
przeglądarki", "db:check pominięte: schemat bez zmian"). Nie twierdź "działa" bez uruchomienia. Padający test,
który nie jest Twój, zgłoś zamiast ukrywać.

## Na końcu

- Commit: Conventional Commits z zakresem z listy w `commitlint.config.ts` (np. `feat(server): ...`).
- Zaktualizuj dziennik postępu (skill `progress-log`) – hash commita, stan, następny krok.
