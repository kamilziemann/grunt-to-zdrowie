# @app/architecture-check

Checker granic importów sterowany przez [`/architecture.config.ts`](../../architecture.config.ts). Skanuje pliki
z `include` minus `exclude`, wyciąga importy lekkim skanerem leksykalnym (bez parsera TS), rozwiązuje je na pliki
i paczki workspace (`exports` z `package.json`), a potem uruchamia reguły.

```bash
bun architecture:check                                   # z roota (text)
bun src/cli/cli.ts --config ../../architecture.config.ts --root ../.. --format github   # adnotacje w Actions
bun src/cli/cli.ts --config … --root … --json --only layers,cycles
```

Kody wyjścia: `0` OK, `1` naruszenia, `2` błąd użycia/konfiguracji. Raport tekstowy: `path:line  rule-id  message`
pogrupowane regułami z licznikami.

| Reguła              | Co sprawdza                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `package-deps`      | paczka importuje tylko `packages[...].allowed`; graf `allowed` bez cykli; każda paczka/aplikacja zadeklarowana                               |
| `no-app-import`     | paczki i narzędzia nie importują aplikacji                                                                                                   |
| `deep-import`       | `@scope/pkg/<sub>` tylko z `exports` lub `deepImports.allowSubpaths`; import względny nie wychodzi poza jednostkę                            |
| `cycles`            | cykle między plikami (Tarjan; bez `import type` i `import()`), raport raz na składową                                                        |
| `layers`            | warstwy aplikacji (`layers.allowed`), warstwa = pierwszy pasujący glob                                                                       |
| `forbidden-modules` | zakazane prefiksy modułów per warstwa (także `import type`)                                                                                  |
| `siblings`          | rodzeństwo w `siblings[].dir` tylko przez `publicFile` (pusty = nigdy); dotyczy plików wewnątrz katalogu                                     |
| `folder-units`      | w `folderUnits.dirs` każda jednostka ma własny folder: brak plików luzem (poza `allowRootFiles`) i import tylko przez `index.ts` folderu     |
| `type-only`         | aplikacja → aplikacja tylko dla par z `typeOnlyImports` i tylko `import type`                                                                |
| `dynamic-import`    | `import()` tylko w `dynamicImports.allow`                                                                                                    |
| `server-client`     | `'use client'` i `noFeatureImportsFrom` nie importują `serverOnly` (poza `import type`); `noFeatureImportsFrom` nie importuje `src/features` |

`folder-units` (konfiguracja: `folderUnits: { dirs, allowRootFiles, ignore? }`) czyta katalogi z dysku, więc łapie też luźne
testy (poza skanem plików). Katalog z `dirs` leżący w innym katalogu z `dirs` (np. `lib/utils` w `lib`) jest grupą:
jednostkami są dopiero jego podfoldery. Prywatny plik jednostki to każdy plik w jej folderze poza `index.*` w korzeniu folderu;
importować go wolno tylko z wnętrza tego samego folderu. `ignore` wyłącza podkatalogi, które nie są jednostkami (np. dane
generowane). Bez sekcji `folderUnits` reguła jest wyłączona.

API programowe: `runArchitectureCheck(config, root, { only?, configPath? })` z `src/index.ts`. Testy:
`bun run test` (vitest pod Bunem) na fixtures `test/fixtures/{valid,invalid}` + testy jednostkowe ekstraktora,
resolvera, grafu i raportów.
