# Grunt to Zdrowie

**Zespół:** KDKZ · **Zadanie:** KOWR „Zatrzymaj wodę, chroń plony” (HackNation 2026)

- **Działająca wersja:** <https://grunt-to-zdrowie.hoxu.workers.dev> (strony i API; dokumentacja API: `/api/docs`)
- **Jak liczymy** (metody, źródła, licencje, ograniczenia — w aplikacji):
  <https://grunt-to-zdrowie.hoxu.workers.dev/jak-liczymy>
- **Raporty wzorcowe (PDF):** [`docs/samples/`](docs/samples/README.md)
- **Szczegóły zgłoszenia:** [README konkursowe](docs/submission/README-konkursowe.md) (źródła, metody, koszty,
  skala, bezpieczeństwo), [licencje](docs/submission/licencje.md), [walidacja](docs/validation.md)
- Prezentacja PDF i film: _[linki — do uzupełnienia]_

## Opis rozwiązania

**Problem.** Rolnik widzi, że pole przesycha, ale nie wie, czy to susza w okolicy, słaba gleba, rów, który szybko
odprowadza wodę, czy wszystko naraz — i co zrobić najpierw. Dane, które na to odpowiadają (pogoda, gleba, rowy,
zdjęcia satelitarne, ewidencja), są publiczne, ale rozproszone i wymagają GIS.

**Rozwiązanie.** Aplikacja webowa: rolnik wpisuje numer działki ewidencyjnej (albo wskazuje ją na mapie), wybiera
uprawę i dzień, a aplikacja **liczy** raport o wodzie na tym polu: ocena → przyczyny → zatrzymanie wody (retencja) →
agrotechnika → ewentualne nawadnianie, z danymi, datami ich pobrania i ograniczeniami. Nikt nie wpisuje gotowej
diagnozy: raport powstaje od nowa z danych publicznych dla wskazanego pola i dnia (dowolny dzień z ostatnich 10 lat).

**Wykorzystanie danych.** Pogoda z 10 lat i prognoza, gleba z modelu, rowy i wody z mapy topograficznej, zdjęcia
Sentinel-2, teren i ewidencja działki są łączone w dwa rachunki wody (klimatyczny bilans wodny wg IUNG i dobowy
bilans strefy korzeniowej FAO-56) oraz w jawne reguły przyczyn i zaleceń, każda z liczbą, która ją uzasadnia.

**Korzyści.** Odpowiedź w kilka sekund, bez GIS i bez konta; język rolnika na górze raportu, liczby dla doradcy
niżej; zalecenia zaczynają od tanich działań, które zatrzymują wodę na polu, a nawadnianie jest na końcu; każdy
wynik ma podaną pewność i źródło; raport do wydruku (A4/PDF) i do przesłania linkiem.

## Funkcje

- **Wybór pola** (`/`, `/mapa`): jedno pole wyszukiwania (pełny numer działki, „obręb numer” z listą kandydatów,
  adres), kliknięcie działki na mapie, kilka działek naraz, własne pole narysowane na mapie albo działka podzielona
  linią. Warstwy: granice działek, zdjęcie lotnicze, rowy i cieki, otoczenie pola, zdjęcia satelitarne.
- **Uprawa i dzień** (`/analiza`): katalog 15 upraw z kalendarzem rozwoju, dzień z ostatnich 10 lat (domyślnie dziś).
- **Raport** (`/raport`), silnik analizy w wersji **0.8.5**: ocena z pewnością (wysoka / średnia / niska); zbiornik
  wody w glebie (ile procent zostało, ile zwykle, za ile dni bez deszczu zacznie się stres); prognoza na 7 dni;
  rachunek wody od 21 marca; 10 poprzednich sezonów i kalendarz ryzyka; przyczyny z dowodami liczbowymi i udziałem;
  zalecenia w stałej kolejności (retencja → agrotechnika → nawadnianie z dawką) z uwagą o formalnościach
  wodnoprawnych; miejsca na polu (2–5 stref z mapy satelitarnej i terenu); otoczenie pola; źródła z trybem i datą
  pobrania; ograniczenia. Wydruk A4, eksport CSV/JSON, raport otwiera się z linku.
- **Gospodarstwo** (`/gospodarstwo`): kilka działek osobno i kolejność „gdzie działać najpierw”.
- **Jak liczymy** (`/jak-liczymy`): metoda, źródła, licencje, czego nie wiemy — prostym językiem.
- **API** (`/api`, OpenAPI pod `/api/docs`): m.in. `POST /api/analysis`, `GET /api/reports/{id}`,
  `/api/parcels/*`, `/api/places/search`.

Ścieżka dla jury (numer działki → uprawa → data → raport) z przykładowymi działkami:
[README konkursowe](docs/submission/README-konkursowe.md#ścieżka-jury-numer-działki--uprawa--data--raport).

## Architektura w skrócie

```
przeglądarka ──▶ Cloudflare Workers Cache ──▶ jeden Worker `grunt-to-zdrowie` (apps/web)
                                               ├─ strony: TanStack Start (React 19, SSR)
                                               └─ /api: Hono (apps/server) ── silnik analizy
                                                    ├─ D1: zapisane raporty, pamięć działek (30 dni)
                                                    ├─ Neon Postgres + PostGIS: BDOT10k (import wcześniej)
                                                    └─ usługi publiczne na bieżąco: NASA POWER, MET Norway,
                                                       SoilGrids, Copernicus, Terrain Tiles, GUGiK, OSM
```

- **Jeden Worker Cloudflare** serwuje strony i API ([ADR 0008](docs/architecture/decisions/0008-tanstack-start-single-worker.md));
  mapa na MapLibre GL ([ADR 0009](docs/architecture/decisions/0009-field-style-and-maplibre.md)).
- **API** w warstwach: trasy (`modules`) → przypadki użycia (`services`) → czyste obliczenia (`domain`: KBW, FAO-56,
  gleba, przyczyny, zalecenia); każde źródło danych to adapter za portem (`infrastructure`), więc źródło można
  wymienić bez zmiany silnika. Źródła są pytane równolegle z limitem czasu; gdy któreś milczy, raport jest
  „częściowy” i mówi, czego brakuje.
- **Kontrakty** (`packages/contracts`): jeden schemat Zod raportu dla API i stron.
- **Dane** ([ADR 0001](docs/architecture/decisions/0001-d1-instead-of-postgres.md),
  [ADR 0010](docs/architecture/decisions/0010-postgis-on-neon-for-hydrography.md),
  [ADR 0011](docs/architecture/decisions/0011-no-user-accounts.md)): D1 na zapisane raporty i pamięć działek,
  PostGIS na Neon na BDOT10k, bez kont użytkowników.

Więcej: [`docs/architecture/overview.md`](docs/architecture/overview.md),
[`docs/architecture/deployment.md`](docs/architecture/deployment.md).

## Dane: źródła, zakresy, sposób pobrania

Każdy raport podaje przy każdym źródle sposób pobrania (`sources[].mode`: `live` = na bieżąco, `preloaded` =
zaimportowane wcześniej) i datę (`sources[].fetchedAt`). Wynik i zalecenia zawsze liczy aplikacja z tych danych.

| Dane                                                   | Źródło                                               | Zakres                                                                    | Pobieranie                        |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| Pogoda dobowa                                          | NASA POWER                                           | 10 lat wstecz od dnia analizy, siatka ok. 50 km                           | na bieżąco                        |
| Prognoza (analiza „na dziś”)                           | MET Norway Locationforecast 2.0                      | 7 dni                                                                     | na bieżąco                        |
| Skład gleby → zapas wody, kategoria                    | SoilGrids (ISRIC)                                    | model 250 m; zapas wody liczony dla 0–100 cm                              | na bieżąco                        |
| Zieloność i wilgotność roślin, strefy                  | Copernicus Sentinel-2 (Copernicus Data Space)        | 30 dni przed dniem analizy, tło: ta sama pora roku w 5 poprzednich latach | na bieżąco                        |
| Ukształtowanie terenu                                  | Terrain Tiles (EU-DEM / SRTM)                        | ok. 30 m                                                                  | na bieżąco                        |
| Granice, powierzchnia, klasy użytków                   | ULDK i EGiB (WFS), GUGiK                             | stan dzisiejszy                                                           | na bieżąco (pamięć w D1 30 dni)   |
| Rowy, cieki, wody, mokradła                            | BDOT10k, GUGiK (GeoParquet, schemat 2021)            | cała Polska; w raporcie promień 500 m od pola                             | **wcześniej:** import 21.11.2026  |
| Otoczenie pola (drzewa, jazy, wały, obszary chronione) | BDOT10k, GUGiK                                       | cała Polska; drzewa do 15 m od granicy, budowle wodne do 3 km             | **wcześniej:** import 22.11.2026  |
| Progi suszy KBW                                        | rozporządzenie MRiRW (Dz.U. 2019 poz. 739), IUNG-PIB | 14 grup upraw × 4 kategorie gleby × 14 okresów                            | tabela w kodzie (spr. 21.11.2026) |
| Zdjęcie lotnicze, podkład, adresy (mapa)               | Ortofotomapa GUGiK; OpenFreeMap i Nominatim (OSM)    | —                                                                         | na bieżąco (tylko mapa)           |

Import BDOT10k: skrypt `bun run bdot:import` ([`tools/bdot-import/README.md`](tools/bdot-import/README.md)),
hydrografia 21.11.2026 ok. 21:40, otoczenie pola 22.11.2026 ok. 00:07; data importu jest w tabeli `bdot_import` i
trafia do raportu jako `fetchedAt`. Odpowiedzi źródeł „na bieżąco” są krótko zapamiętywane (historia 30 dni,
ostatnie dni 3 godziny), raport „na dziś” liczy się od nowa po dobie. Metody i progi:
[README konkursowe, „Metody”](docs/submission/README-konkursowe.md#metody) i strona `/jak-liczymy`.

## Weryfikacja wyników

- **Porównanie z ogłoszeniami IUNG** ([`docs/validation.md`](docs/validation.md)): 21 przypadków z Systemu
  Monitoringu Suszy Rolniczej IUNG-PIB (8 z suszą, 13 bez), liczone przez prawdziwe API skryptem
  `apps/server/scripts/validate-iung.ts`. Zgodność poziomu 21/21, zgodność KBW 20/21, werdykty dla czterech kategorii
  gleby 60/64. Ostatnia powtórka na silniku 0.8.5 (22.11.2026): tabela bez zmian. Wersje 0.8.1–0.8.5 zmieniły pewność, zaokrąglenia, odczyt satelity wg uprawy, przyczyny i
  zalecenia poza sezonem, nie rachunek oceny.
- **Progi i wzory ze źródłem**: 784 wartości progów KBW porównane ze stroną IUNG; bilans FAO-56 odtwarza przykłady
  37 i 38 z publikacji FAO-56 (test jednostkowy).
- **Testy przeliczone ręcznie** dla każdej reguły silnika (susza zakończona ulewą, uprawa poza sezonem, luki w
  pogodzie, brak prognozy); rachunek wody ma test bilansowania. Cały zestaw: `bun check`.
- **W raporcie**: pewność oceny z powodami jej obniżenia, liczba przy każdej przyczynie, informacja, czy inna
  kategoria gleby zmieniłaby ocenę, źródła z datami.
- **Czego nie weryfikujemy**: nie mamy pomiarów wilgotności gleby ani plonów z pól — wynik to model; raport mówi to
  wprost.

## Ograniczenia

- Pogoda z siatki ok. 50 km — lokalna burza albo upał mogą być niewidoczne lub wygładzone.
- Gleba z modelu 250 m często myli się o jedną kategorię; raport pokazuje, czy inna kategoria zmieniłaby ocenę.
- Nie mierzymy wilgotności na polu; najpewniejszy sprawdzian to łopata i ręka.
- Granice działek są dzisiejsze — także dla analiz sprzed kilku lat; powierzchnia z geometrii może różnić się od
  ewidencyjnej.
- Rowy znamy z mapy, nie wiemy, czy są drożne; BDOT10k nie ma zastawek ani przepustów.
- Model terenu ok. 30 m — na małym polu spadek jest przybliżeniem; strefy na polu powstają z jednego zdjęcia.
- BDOT10k to stan z dnia importu; odświeżenie = ponowny import.
- Usługi publiczne nie mają gwarancji dostępności i limitują ruch (ULDK: 200 zapytań/min w dzień, 40/min nocą na
  adres IP; Copernicus: limit konta). Mamy zapasowe źródło działek (WFS), pamięć działek i odpowiedzi, ale szukanie
  po „obręb numer” zależy od ULDK.
- Bez sekretów (lokalnie) raport powstaje bez BDOT10k i zdjęć satelitarnych — oba braki są opisane w raporcie.

## Użycie AI

**Aplikacja w działaniu nie używa sztucznej inteligencji.** Nie woła modeli językowych ani usług AI (w kodzie
`apps/` i `packages/` nie ma klientów OpenAI, Anthropic, Gemini ani innych). Ocenę, przyczyny i zalecenia liczą
jawne reguły i modele fizyczne opisane w publikacjach: klimatyczny bilans wodny wg IUNG, bilans strefy korzeniowej
FAO-56, funkcja pedotransferowa Saxton–Rawls (2006). Każdy wynik da się odtworzyć z liczb w raporcie.

Jedyny model uczenia maszynowego w łańcuchu danych to **SoilGrids** — globalne mapy gleby ISRIC przewidywane
modelem uczenia maszynowego. To dane zewnętrzne (CC BY 4.0), nie nasz model; jego niepewność opisujemy w
ograniczeniach.

**AI przy budowie rozwiązania:**

| Narzędzie                                          | Do czego                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Claude Code (Anthropic, modele Claude, m.in. Opus) | pisanie kodu i testów, równoległe sesje wykonawców w osobnych gałęziach, przeglądy zmian, dokumentacja |
| Codex CLI (OpenAI)                                 | notatki z researchu źródeł danych, testy aplikacji „jak rolnik” na wdrożonej wersji, przeglądy         |
| Antigravity CLI (Google, modele Gemini)            | jak wyżej: research i testy aplikacji na wdrożonej wersji                                              |

Zasady: każdą zmianę sprawdzają narzędzia (`bun check`: format, lint, granice architektury, typy, testy) i człowiek;
notatki z researchu agentów są oznaczone jako niezweryfikowane ([`docs/research/`](docs/research/README.md)), a liczby
użyte w kodzie (progi IUNG, wzory, licencje) sprawdzaliśmy u źródła. Przebieg pracy: [`docs/progress/`](docs/progress/README.md).
Przeglądy z 22.11.2026 szły na domyślnym modelu Codex CLI oraz w Antigravity na modelu Claude Opus; wersje modeli z
wcześniejszego researchu — **do potwierdzenia**.

## Biblioteki, komponenty, usługi i licencje

Pełny wykaz z wersjami i licencjami: [`docs/submission/licencje.md`](docs/submission/licencje.md). W skrócie:

- **Strony**: React 19, TanStack Start / Router / Query, MapLibre GL (BSD-3-Clause), Radix UI, Tailwind CSS,
  lucide-react, use-intl, krój Geist (OFL-1.1).
- **API**: Hono z `@hono/zod-openapi`, Zod, Drizzle ORM (D1), `@neondatabase/serverless` (PostGIS).
- **Narzędzia**: TypeScript, Vite, Vitest, Playwright + axe, oxlint, oxfmt, Turborepo, Wrangler, Bun.
- **Usługi**: Cloudflare Workers, D1, Workers Cache, Observability; Neon (Postgres + PostGIS); Copernicus Data Space.
- **Dane**: NASA POWER (CC BY 4.0), MET Norway (CC BY 4.0), SoilGrids (CC BY 4.0), Copernicus Sentinel-2 (otwarte
  dane Copernicus), Terrain Tiles (atrybucja EU-DEM i SRTM), GUGiK — ULDK, EGiB, BDOT10k, ortofotomapa (bezpłatne,
  z podaniem źródła), OpenStreetMap przez OpenFreeMap i Nominatim (ODbL), progi KBW z rozporządzenia MRiRW.

Biblioteki runtime mają licencje MIT, ISC, Apache-2.0, BSD-3-Clause i OFL-1.1. Licencja kodu własnego — **do
potwierdzenia** przez zespół.

## Koszty, skala, bezpieczeństwo

**Koszty (pkt 5.4).** Źródła danych są bezpłatne. Płatne warstwy: Cloudflare Workers Paid (5 USD/mies.; D1 w cenie)
i Neon Launch (przechowywanie BDOT10k ok. 1,45 GB i czas pracy bazy) — razem rząd wielkości **ok. 12 USD/mies.** przy
ruchu konkursowym (szacunek; wdrożenie działa na planie Workers Paid i Neon Launch — potwierdzone przez zespół;
zmierzony czas CPU analizy **do potwierdzenia**). Baza BDOT10k (ok. 1,45 GB) nie mieści się w darmowym planie Neon
(0,5 GB); może to być dowolny Postgres z PostGIS, ale Worker łączy się dziś sterownikiem HTTP Neon
(`@neondatabase/serverless`), więc inna baza wymaga podmiany jednego adaptera (`hydro-postgis/neon-runner.ts`). Copernicus:
darmowe konto (10 000 zapytań/mies.). Alternatywy: Supabase, własny serwer z PostGIS (np. Hetzner), BDOT10k w plikach
R2 zamiast bazy. Ceny, limity i źródła: [README konkursowe, pkt 5.4](docs/submission/README-konkursowe.md#infrastruktura-i-koszty-pkt-54).

**Skala (pkt 5.5).** Worker skaluje się sam; odpowiedzi źródeł, działki i gotowe raporty są zapamiętywane (ten sam
wniosek wraca w milisekundach). Analiza nowego pola: 2,6–6,3 s lokalnie, 4,6 s w chmurze (wymóg: do 30 s).
Pierwszym wąskim gardłem przy wielu rolnikach są limity ULDK i Copernicus — opis i plan:
[README konkursowe, pkt 5.5](docs/submission/README-konkursowe.md#skala-wielu-rolników-pkt-55).

**Bezpieczeństwo i dane osobowe (pkt 5.6).** Aplikacja nie ma kont, logowania ani formularzy z danymi osoby
([ADR 0011](docs/architecture/decisions/0011-no-user-accounts.md)); numer i granice działki to publiczne dane
ewidencji, lista działek żyje w adresie strony. Sekrety (Neon, Copernicus) są sekretami Workera, poza repozytorium;
zmienne środowiska są walidowane; zapytania do bazy parametryzowane; błędy w formacie Problem Details bez szczegółów
wewnętrznych. Szczegóły: [README konkursowe, pkt 5.6](docs/submission/README-konkursowe.md#bezpieczeństwo-pkt-56).

## Uruchomienie lokalne

Wymagania: **Bun** w wersji z [`.bun-version`](.bun-version) (1.4.2) i **Node** ≥ 22.12 (Vite, Vitest i Wrangler
biegną pod Node). Konto Cloudflare potrzebne jest tylko do wdrożenia.

```bash
bun install                                              # zależności + hooki gita (lefthook)
cp apps/web/.dev.vars.example apps/web/.dev.vars         # lokalne sekrety Workera (żaden nie jest wymagany)
bun run setup:local                                      # lokalna baza D1: migracje
bun run dev                                              # jeden serwer: strony + API (vite dev w workerd)
```

- Aplikacja: <http://localhost:3000>, API: <http://localhost:3000/api> (OpenAPI: <http://localhost:3000/api/docs>).
- Bez sekretów analiza działa (pogoda, prognoza, gleba, teren, działki); raport jest „częściowy” bez BDOT10k i
  zdjęć satelitarnych. Pełne dane: w `apps/web/.dev.vars` ustaw `DATABASE_URL` (Postgres z PostGIS z
  zaimportowanym BDOT10k, `bun run bdot:import`) oraz `COPERNICUS_CLIENT_ID` i `COPERNICUS_CLIENT_SECRET` (darmowe
  konto Copernicus Data Space). Opis zmiennych: `apps/web/.dev.vars.example`.
- Lokalna baza sprzed 2026-11-22 (z tabelami kont) ma starą historię migracji: usuń `apps/web/.wrangler/state` i
  uruchom `bun run setup:local` ponownie.

## Dla deweloperów

| Komenda                        | Co robi                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `bun dev`                      | `vite dev` w `apps/web` (:3000): strony + API pod `/api` + D1 w workerd                          |
| `bun check`                    | po kolei: `format:check` → `lint` → `architecture:check` → `docs:check` → `check:types` → `test` |
| `bun format`                   | oxfmt + autofix pustych linii                                                                    |
| `bun test:e2e`                 | Playwright (`apps/web/e2e`) na `vite dev` (strony + API, świeża lokalna D1)                      |
| `bun run build`                | `turbo run build` (bez `run` Bun uruchomi własny bundler)                                        |
| `bun db:generate` / `db:check` | migracja SQL ze schematu `packages/db/src/schema.ts` / zgodność migracji ze schematem            |
| `bun run deploy`               | `tools/scripts/deploy.ts`: zasoby, migracje D1, build i deploy jedynego Workera                  |

- Struktura: `apps/web` (jedyny Worker: strony + wejście), `apps/server` (API i silnik analizy), `packages/*`
  (kontrakty, baza, środowisko, HTTP, cache, logger, klient RPC), `tools/*` (checker architektury, zgodność
  dokumentacji, import BDOT10k, skrypty), `docs/` (stan projektu, plany, ADR-y, dziennik, research).
- Sekrety: `apps/web/.dev.vars.example` → `apps/web/.dev.vars` (w `.gitignore`); zmienne niesekretne w
  `apps/web/wrangler.jsonc` → `vars`; walidacja w `packages/env/src/server.ts`; produkcja:
  `wrangler secret put NAZWA --env production`.
- Zasady pracy w repo (ludzie i agenci AI): [`AGENTS.md`](AGENTS.md); stan prac, plan i decyzje:
  [`docs/project-status.md`](docs/project-status.md).
