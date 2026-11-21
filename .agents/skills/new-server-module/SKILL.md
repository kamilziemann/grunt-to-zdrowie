---
name: new-server-module
description: Dodaje nowy zasób API end-to-end (kontrakt, tabela, repozytorium, serwis, moduł Hono/OpenAPI, kontener, test integracyjny). Użyj, gdy ktoś prosi o "nowy endpoint", "nowy zasób", "nowy moduł serwera", "CRUD dla X", "dodaj API do X".
---

# Nowy moduł serwera (zasób API)

Wzorzec do skopiowania: zasób `parcels` (kontrakt, serwis, moduł, test integracyjny; dane z zewnętrznych usług przez
port w `domain/` i adapter w `infrastructure/`). Zasób z własną tabelą dochodzi krokami 2–3. Zasady warstw: `AGENTS.md`
(root) i `apps/server/AGENTS.md` są nadrzędne wobec tej listy. Kolejność ma znaczenie: każdy krok kompiluje się
na poprzednim.

## Kroki

1. **Kontrakt** – `packages/contracts/src/<x>.ts` (wzór: `parcel.ts`): `<x>Schema`, `Create<X>InputSchema`,
   `Update<X>InputSchema` (częściowa zmiana + `.refine` na "przynajmniej jedno pole"), stałe limitów
   `<X>_LIMITS`, typy z `z.infer`. Dopisz `export * from './<x>'` w `packages/contracts/src/index.ts`.
   Nowy kod błędu → `packages/contracts/src/problems.ts` (+ komunikat `problems.<kod>` w `apps/web/messages/{pl,en}/problems.json`).
2. **Tabela** – `packages/db/src/schema.ts` + unikalny 3-literowy prefiks id dla `createId` (`packages/db/src/ids.ts`). Potem skill `db-change` (`bun db:generate`, `bun db:migrate`).
3. **Repozytorium** – `apps/server/src/repositories/<x>/<x>.repository.ts`: `create<X>Repository(db: Db)`,
   mapper `toX(row)`, tylko zapytania Drizzle. Lista = kursor `(created_at, id)`, pobiera `limit + 1`.
4. **Serwis** – `apps/server/src/services/<x>/`: `<x>.service.ts` (`create<X>Service({ repo, newId, now })`),
   `ports.ts` (interfejs `<X>RepositoryPort`; serwis nie zna Drizzle ani `@app/db`), `index.ts` (eksport
   fabryki, typu serwisu i portu), `<x>.service.test.ts` (fake repo w pamięci, błędy przez `isAppError`).
   Błędy: tylko `AppError` z `@app/http` (`AppError.notFound('X', id)`). Czystą logikę reguł (normalizacja,
   walidacje) wynieś do `apps/server/src/domain/<nazwa>/` (folder na jednostkę: `<nazwa>.ts`, test, `index.ts`).
5. **Moduł HTTP** – `apps/server/src/modules/<x>/`:
   - `<x>.schemas.ts` – kontrakty z contracts z nazwami komponentów OpenAPI: `.meta({ id: 'X' })`;
   - `<x>.routes.ts` – `createRoute` (tagi, summary, `jsonResponse`/`jsonBody`/`notFound`/`validationFailed`
     z `src/lib/openapi`);
   - `<x>.handlers.ts` – cienkie handlery `RouteHandler<typeof route, AppEnv>`, serwis z
     `c.get('container').<x>`;
   - `index.ts` – `new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(...)` w jednym
     łańcuchu (typ dla klienta RPC). Moduł nie importuje innych modułów (`siblings`) ani Drizzle.
6. **Okablowanie** (3 pliki):
   - `apps/server/src/services/container/index.ts` – pole w interfejsie `Container`;
   - `apps/server/src/container.ts` – `create<X>Service({ repo: create<X>Repository(db), newId: () => createId('<prefiks>'), now })`
     i dopisanie do zwracanego obiektu;
   - `apps/server/src/entry/routes/index.ts` – `.route('/<x>', <x>Module)` w tym samym łańcuchu.
7. **Test integracyjny** – `apps/server/test/integration/<x>.test.ts` (wzór: `parcels.test.ts`, `makeApp` z
   `../helpers`, stały zegar, zewnętrzne źródła podmienione przez `ContainerOverrides`): odczyty, walidacja (400),
   404, a dla zasobu z tabelą także CRUD i paginacja kursorem.
8. **Weryfikacja** – skill `verify-change`; dodatkowo `bun run --cwd apps/server test` na bieżąco.
   Gdy zasób ma ekran w `apps/web`: skill `new-web-feature`.

## Pułapki

- Warstwy: `modules` → `services` → `repositories`; `services` nie importują `hono`, `drizzle-orm`, `@app/db`.
- Wielozapytaniowe zmiany atomowo: `db.batch([...])` (D1 nie ma interaktywnych transakcji).
- Zero I/O na poziomie modułu; zależności tylko przez kontener.
- Nie dopisuj tras poza łańcuchem w `entry/routes/index.ts` (typ `AppType` straci trasy).
