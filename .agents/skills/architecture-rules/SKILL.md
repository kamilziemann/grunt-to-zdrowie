---
name: architecture-rules
description: Ściąga po regułach `bun architecture:check` - co znaczy każdy identyfikator reguły i jak zwykle naprawić naruszenie. Użyj, gdy architecture:check zgłasza błąd (package-deps, layers, siblings, folder-units, server-client...) albo gdy pytasz "gdzie wolno zaimportować X", "dodaj paczkę", "zmień regułę".
---

# Reguły architektury

Konfiguracja: `architecture.config.ts` (typy w `tools/architecture-check`), checker: `tools/architecture-check`
(`README.md` opisuje reguły). Opis słowami: `AGENTS.md` (root, sekcja "Reguły architektury") i pliki per obszar.

```bash
bun architecture:check                                   # wszystkie reguły
bun src/cli/cli.ts --config ../../architecture.config.ts --root ../.. --only layers,cycles   # z tools/architecture-check
```

Raport: `plik:linia  id-reguły  powód`, kod wyjścia 0/1 (naruszenia)/2 (błąd konfiguracji). Flaga `--only <id,...>`
zawęża do reguł; `--json`/`--format github` zmieniają format.

## Reguły i typowa naprawa

| id                  | znaczenie                                                                                                                                           | zwykła naprawa                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `package-deps`      | paczka importuje tylko to, co w `packages['@app/x'].allowed`; graf acykliczny                                                                    | dopisz zależność w `package.json` (`workspace:*`) **i** `allowed`; nowa paczka = wpis w configu |
| `no-app-import`     | `packages/*` i `tools/*` nie importują `apps/*`                                                                                                     | przenieś kod wspólny do paczki; typ serwera do web tylko przez `@app/server/types`           |
| `deep-import`       | `@app/x/<sub>` tylko z `exports` lub `deepImports.allowSubpaths`; względne nie wychodzą poza paczkę                                              | importuj z publicznego API; albo dodaj subpath do `exports`                                     |
| `cycles`            | cykle importów statycznych/re-eksportów (bez `import type` i `import()`)                                                                            | wynieś wspólny kod do trzeciego pliku lub użyj `import type`                                    |
| `layers`            | warstwa pliku importuje tylko dozwolone warstwy (`modules` → `services` → `repositories`/`domain`/`lib`)                                            | przenieś logikę do właściwej warstwy; handler woła serwis, nie repozytorium                     |
| `forbidden-modules` | warstwa zna zakazane moduły (np. `services` nie zna `hono`, `drizzle-orm`, `@app/db`) – także `import type`                                      | wstrzyknij przez port (`services/<x>/ports.ts`) zamiast importować                              |
| `siblings`          | rodzeństwo nie zagląda do środka: `modules/<a>` ↛ `modules/<b>`, `services/<a>` → `services/<b>/index.ts`, `features/<a>` → `features/<b>/index.ts` | importuj przez `index.ts`; wspólny kod do `lib`/`domain`/`components/shared`                    |
| `type-only`         | między aplikacjami tylko `import type` i tylko pary z `typeOnlyImports` (web → server)                                                              | zmień na `import type`; usuń import `import()`/`require`                                        |
| `dynamic-import`    | `import()` tylko w `dynamicImports.allow` (`apps/web/src`, `engine/browser`, `server/infrastructure`)                                               | zmień na statyczny import albo przenieś kod do dozwolonego katalogu                             |
| `server-client`     | katalogi wspólne (`components/ui`, `components/shared`, `lib`) nie importują `features/**` (także typów)                                          | przenieś komponent do featura albo przekaż dane propsami                                        |
| `folder-units`      | w `folderUnits.dirs` każda jednostka ma folder `<nazwa>/` z `<nazwa>.ts(x)`, testem i `index.ts`; import tylko przez folder                         | przenieś plik do `<nazwa>/`, dodaj `index.ts` (`export * from './<nazwa>'`), importuj folder    |

## Zmiana reguły (świadoma)

1. Zmień `architecture.config.ts` (nowy katalog jednostek: `folderUnits.dirs`; nowa paczka: `packages`;
   wyjątek importu: odpowiednia sekcja).
2. Dodaj test na fixtures w `tools/architecture-check/test/fixtures` i uruchom `bun run --cwd tools/architecture-check test`.
3. Zaktualizuj opis w `AGENTS.md` (i w README checkera); większa zmiana zasad = ADR (skill `write-adr`).

Nie obchodź reguł komentarzami ani lukami w configu "żeby przeszło" – napraw kod albo przeprowadź zmianę
reguły powyższą ścieżką. Plugin oxlint `arch/no-cross-feature-import` zgłasza część reguł już w edytorze.
