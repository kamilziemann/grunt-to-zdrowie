---
name: db-change
description: Zmiana schematu bazy D1/Drizzle - nowa tabela, kolumna, indeks, migracja. Użyj przy "dodaj tabelę", "nowa kolumna", "zmień schemat", "migracja", "db:generate", "drizzle", "D1".
---

# Zmiana schematu bazy (D1 + Drizzle)

Źródło prawdy to `packages/db/src/schema.ts`. Migracje SQL są **generowane** do `packages/db/migrations`
(`drizzle-kit`), a stosuje je wrangler (`apps/server`). Nigdy nie pisz ani nie edytuj migracji ręcznie.

## Kroki

1. **Edytuj `packages/db/src/schema.ts`** (`sqliteTable`, kolumny snake_case w SQL, camelCase w TS). Typy wierszy:
   `typeof t.$inferSelect` / `$inferInsert`. Nowy rodzaj rekordu → unikalny 3-literowy prefiks id:
   `createId('<prefiks>')` (`packages/db/src/ids.ts`).
2. **Wygeneruj migrację**: `bun db:generate` (z roota; = `drizzle-kit generate` w `packages/db`). Przejrzyj
   powstały plik SQL i snapshot – oba commituj.
3. **Zastosuj lokalnie**: `bun db:migrate` (= `wrangler d1 migrations apply DB --local` w `apps/server`).
   Zdalnie: `bun run --cwd apps/server db:migrate:remote` – tylko na wyraźne polecenie użytkownika.
4. **Sprawdź spójność**: `bun db:check` (`drizzle-kit check` + `packages/db/scripts/check-migrations.ts`).
5. **Dopasuj kod**: repozytorium (`apps/server/src/repositories/<x>`), kontrakt (`packages/contracts`), testy. Testy integracyjne dostają migracje przez `test/apply-migrations.ts`.
6. Pełna weryfikacja: skill `verify-change` (z `bun db:check`).

## Zasady D1/SQLite

- **Brak interaktywnych transakcji** – wielozapytaniowe zmiany atomowo przez `db.batch([...])` (patrz komentarz w
  `packages/db/src/client.ts`).
- **JSON**: kolumna `text('...', { mode: 'json' }).$type<T>()`, gdzie `T` pochodzi z `@app/contracts`
  (D1 nie ma typu JSON). Odczyt scalaj z wartościami domyślnymi, żeby stare wiersze dostawały nowe pola.
- Czas jako ISO string (`nowIso()`), id jako tekst z prefiksem. Brak typu boolean/date – używaj integer/text.
- Zmiany niekompatybilne (usunięcie/zmiana typu kolumny) rób etapami: dodaj nową → przepisz dane → usuń starą.
  SQLite ma ograniczone `ALTER TABLE`; drizzle-kit odtworzy tabelę, więc sprawdź SQL.
- Nowa kolumna `NOT NULL` w istniejącej tabeli wymaga wartości domyślnej.
- Indeksy pod faktyczne zapytania (np. kursor listy `(created_at, id)`).
- Migracje wykonane na zdalnej bazie są nieodwracalne: nie edytuj już zastosowanych, dopisuj nowe.
