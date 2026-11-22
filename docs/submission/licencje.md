# Grunt to Zdrowie — licencje bibliotek, usług i danych

Wykaz do pkt 4.2 ppkt 6–7 regulaminu zadania (biblioteki, komponenty, modele, usługi zewnętrzne i warunki korzystania).
Wersje i licencje bibliotek wygenerowano 22.11.2026 z plików `package.json` wszystkich workspace'ów i pola `license`
w zainstalowanych paczkach (`node_modules`, zgodnie z `bun.lock`). Licencje danych i usług przepisano ze strony „Jak
liczymy” (`apps/web/messages/pl/method.json`) i z [README konkursowego](README-konkursowe.md), gdzie są też adresy,
pod którymi sprawdzono podstawy prawne. Pozycje, których nie potwierdziliśmy u źródła, są oznaczone **„do
potwierdzenia”**.

Kod własny aplikacji (`apps/*`, `packages/*`, `tools/*`) nie ma jeszcze wybranej licencji (`"private": true`
w `package.json`) — **do potwierdzenia** przez zespół przed przekazaniem rozwiązania KOWR.

## Biblioteki działające w aplikacji (runtime)

Bezpośrednie zależności. Paczki `@app/*` to kod własny repozytorium (workspace), pominięte.

### Strony (`apps/web`, przeglądarka i SSR w Workerze)

| Paczka                             | Wersja   | Licencja     | Do czego                                                |
| ---------------------------------- | -------- | ------------ | ------------------------------------------------------- |
| `react`, `react-dom`               | 19.3.1   | MIT          | interfejs                                               |
| `@tanstack/react-start`            | 1.169.4  | MIT          | framework stron (SSR, trasy serwerowe)                  |
| `@tanstack/react-router`           | 1.170.46 | MIT          | routing                                                 |
| `@tanstack/react-query`            | 5.104.5  | MIT          | pobieranie i cache danych z API                         |
| `@tanstack/react-router-ssr-query` | 1.167.3  | MIT          | połączenie routera i zapytań przy SSR                   |
| `maplibre-gl`                      | 6.19.0   | BSD-3-Clause | mapa wektorowa (działki, rowy, zdjęcia)                 |
| `hono`                             | 4.13.13  | MIT          | typowany klient API (`hono/client`)                     |
| `zod`                              | 4.6.7    | MIT          | walidacja formularzy i odpowiedzi                       |
| `use-intl`                         | 4.14.9   | MIT          | teksty interfejsu (komunikaty po polsku)                |
| `radix-ui`                         | 1.8.1    | MIT          | dostępne elementy interfejsu (okna, menu, przełączniki) |
| `lucide-react`                     | 1.58.0   | ISC          | ikony                                                   |
| `class-variance-authority`         | 0.7.1    | Apache-2.0   | warianty klas komponentów                               |
| `clsx`                             | 2.1.1    | MIT          | składanie klas CSS                                      |
| `tailwind-merge`                   | 3.7.0    | MIT          | scalanie klas Tailwind                                  |
| `@fontsource-variable/geist`       | 5.3.0    | OFL-1.1      | krój pisma Geist (SIL Open Font License 1.1)            |

Style budowane w czasie kompilacji: `tailwindcss` 4.3.3 (MIT), `tw-animate-css` 1.4.0 (MIT).

### API (`apps/server` i paczki wspólne, w tym samym Workerze)

| Paczka                     | Wersja  | Licencja   | Do czego                                                               |
| -------------------------- | ------- | ---------- | ---------------------------------------------------------------------- |
| `hono`                     | 4.13.13 | MIT        | serwer HTTP API                                                        |
| `@hono/zod-openapi`        | 1.6.3   | MIT        | trasy z opisem OpenAPI i walidacją Zod                                 |
| `zod`                      | 4.6.7   | MIT        | kontrakty (`packages/contracts`), zmienne środowiska (`packages/env`)  |
| `drizzle-orm`              | 0.45.4  | Apache-2.0 | dostęp do bazy D1 (zapisane raporty, pamięć działek)                   |
| `@neondatabase/serverless` | 1.2.0   | MIT        | zapytania do Postgresa z PostGIS na Neon (BDOT10k)                     |
| `@sentry/cloudflare`       | 11.8.0  | MIT        | raportowanie błędów — w kodzie, domyślnie wyłączone (`SENTRY_ENABLED`) |

## Narzędzia (budowanie, testy, jakość, import danych)

Nie trafiają do działającej aplikacji.

| Paczka                                                                            | Wersja           | Licencja          | Do czego                                                          |
| --------------------------------------------------------------------------------- | ---------------- | ----------------- | ----------------------------------------------------------------- |
| `typescript`                                                                      | 5.9.3            | Apache-2.0        | typy                                                              |
| `vite`                                                                            | 8.3.5            | MIT               | budowanie i serwer deweloperski                                   |
| `@vitejs/plugin-react`                                                            | 6.1.2            | MIT               | React w Vite                                                      |
| `@cloudflare/vite-plugin`                                                         | 1.65.0           | MIT               | Worker (workerd) w Vite                                           |
| `wrangler`                                                                        | 4.152.0          | MIT OR Apache-2.0 | wdrożenie i lokalna D1                                            |
| `@cloudflare/workers-types`                                                       | 5.20261016.1     | MIT OR Apache-2.0 | typy Workers                                                      |
| `@tailwindcss/vite`, `tailwindcss`                                                | 4.3.3            | MIT               | style                                                             |
| `tw-animate-css`                                                                  | 1.4.0            | MIT               | animacje CSS                                                      |
| `drizzle-kit`                                                                     | 0.31.11          | MIT               | migracje D1                                                       |
| `vitest`                                                                          | 4.1.11           | MIT               | testy jednostkowe i integracyjne                                  |
| `@cloudflare/vitest-plugin`                                                       | 1.4.4            | MIT               | testy API w workerd                                               |
| `jsdom`                                                                           | 30.1.3           | MIT               | testy komponentów                                                 |
| `@testing-library/react`, `@testing-library/dom`                                  | 16.3.3, 10.4.2   | MIT               | testy komponentów                                                 |
| `@testing-library/jest-dom`                                                       | 7.0.1            | MIT               | asercje DOM                                                       |
| `@playwright/test`                                                                | 1.64.1           | Apache-2.0        | testy E2E w przeglądarkach                                        |
| `@axe-core/playwright`                                                            | 4.14.0           | MPL-2.0           | testy dostępności w E2E                                           |
| `@tanstack/react-router-devtools`                                                 | 1.167.2          | MIT               | narzędzia deweloperskie routera                                   |
| `oxlint`, `oxlint-tsgolint`                                                       | 1.88.0, 7.0.2004 | MIT               | lint                                                              |
| `oxfmt`                                                                           | 0.73.0           | MIT               | formatowanie                                                      |
| `turbo`                                                                           | 2.11.9           | MIT               | uruchamianie zadań w monorepo                                     |
| `lefthook`                                                                        | 2.2.2            | MIT               | hooki gita                                                        |
| `@commitlint/cli`, `@commitlint/config-conventional`, `@commitlint/types`         | 21.2.3           | MIT               | sprawdzanie opisów commitów                                       |
| `@neon/config`, `@neon/env`                                                       | 1.14.6, 2.1.9    | Apache-2.0        | konfiguracja projektu Neon (`neon.ts`) i pobranie `DATABASE_URL`  |
| `hyparquet`, `hyparquet-compressors`                                              | 1.33.1, 1.1.3    | MIT               | jednorazowy import BDOT10k z plików Parquet (`tools/bdot-import`) |
| `@types/bun`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/geojson` | różne            | MIT               | typy                                                              |

Środowisko: [Bun](https://bun.sh) 1.4.2 (MIT) do instalacji i skryptów, Node.js (MIT) dla Vite, Vitest i Wranglera.

### Zależności pośrednie

Pełne drzewo (ok. 520 paczek) jest w `bun.lock`. Przegląd pola `license` w zainstalowanych paczkach (22.11.2026):
przeważają licencje liberalne (MIT ok. 430, ISC 27, Apache-2.0 25, BSD 14, pozostałe pojedyncze: MIT-0, 0BSD, CC0-1.0,
Unlicense, BlueOak-1.0.0, Python-2.0, CC-BY-4.0 dla `caniuse-lite`). Licencje z warunkami, wszystkie tylko w narzędziach:

- MPL-2.0: `axe-core` i `@axe-core/playwright` (testy dostępności), `lightningcss` (kompilacja CSS w czasie budowania);
- LGPL-3.0-or-later: `@img/sharp-libvips-*` — biblioteka obrazów wciągana przez `miniflare` (lokalny emulator
  Workera z `wrangler` i `@cloudflare/vite-plugin`); nie trafia do wdrożonego Workera.

## Usługi zewnętrzne (infrastruktura)

| Usługa                          | Do czego                                  | Warunki                                                                                                |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Cloudflare Workers              | jeden Worker: strony i API                | regulamin Cloudflare; plan konta wdrożenia (Free/Paid) **do potwierdzenia**                            |
| Cloudflare D1                   | zapisane raporty, pamięć działek (30 dni) | jak wyżej                                                                                              |
| Cloudflare Workers Cache        | pamięć odpowiedzi źródeł i stron          | jak wyżej                                                                                              |
| Cloudflare Observability        | logi i ślady                              | jak wyżej                                                                                              |
| Neon (Postgres 18, PostGIS 3.6) | BDOT10k: wody i otoczenie pola            | regulamin Neon, plan Launch; PostGIS na licencji GPL-2.0 działa po stronie Neon (nie dystrybuujemy go) |
| Copernicus Data Space Ecosystem | API statystyk i Process API Sentinel-2    | darmowe konto, limity konta ogólnego (README konkursowe, pkt 5.4)                                      |
| Sentry                          | raportowanie błędów                       | w kodzie, domyślnie wyłączone                                                                          |

Ceny i limity: [README konkursowe, „Infrastruktura i koszty”](README-konkursowe.md#infrastruktura-i-koszty-pkt-54).

## Dane i modele zewnętrzne

| Dane                                       | Źródło                                                                              | Licencja / warunki                                                                                                                                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pogoda dobowa z 10 lat                     | NASA POWER                                                                          | CC BY 4.0 (NASA Langley Research Center, POWER Project)                                                                                                                                                                                      |
| Prognoza na 7 dni                          | MET Norway Locationforecast 2.0                                                     | CC BY 4.0 (Norwegian Meteorological Institute)                                                                                                                                                                                               |
| Skład gleby                                | SoilGrids (ISRIC) — globalny model uczenia maszynowego ISRIC, 250 m                 | CC BY 4.0 (ISRIC – World Soil Information)                                                                                                                                                                                                   |
| Zieloność i wilgotność roślin, strefy pola | Copernicus Sentinel-2 (Copernicus Data Space)                                       | otwarte dane Copernicus, wymagane oznaczenie „zawiera zmodyfikowane dane Copernicus Sentinel”                                                                                                                                                |
| Ukształtowanie terenu                      | Terrain Tiles (AWS Open Data, terrarium): EU-DEM, SRTM                              | bez jednej licencji kafli; atrybucja każdego źródła: „Produced using Copernicus data and information funded by the European Union - EU-DEM layers”, „SRTM data courtesy of the U.S. Geological Survey” (tilezen/joerd `docs/attribution.md`) |
| Granice, powierzchnia, klasy użytków       | ULDK i EGiB (zbiorcza usługa WFS), GUGiK                                            | dane publiczne GUGiK, bezpłatne, z podaniem źródła; limit ULDK na adres IP                                                                                                                                                                   |
| Rowy, cieki, wody, mokradła; otoczenie     | BDOT10k, GUGiK                                                                      | bezpłatne i do dowolnego wykorzystania od 31.07.2020 (art. 40a ust. 2 pkt 1 lit. h Pgik, Dz.U. 2020 poz. 782; brzmienie przepisu **do potwierdzenia**); regulamin Geoportalu wymaga podania źródła                                           |
| Zdjęcie lotnicze                           | Ortofotomapa GUGiK (WMS)                                                            | bezpłatna i do dowolnego wykorzystania; regulamin Geoportalu wymaga podania źródła                                                                                                                                                           |
| Podkład mapy                               | OpenFreeMap „liberty” (dane OpenStreetMap)                                          | dane ODbL (© autorzy OpenStreetMap); usługa bez klucza i bez gwarancji dostępności; licencja samego stylu „liberty” **do potwierdzenia**                                                                                                     |
| Wyszukiwanie adresów                       | Nominatim (OpenStreetMap)                                                           | ODbL (© autorzy OpenStreetMap); zasady użycia publicznego serwera: ok. 1 zapytanie/s                                                                                                                                                         |
| Progi suszy KBW                            | rozporządzenie MRiRW z 11.04.2019 (Dz.U. 2019 poz. 739), publikowane przez IUNG-PIB | akt normatywny nie jest przedmiotem prawa autorskiego (art. 4 pkt 1 ustawy o prawie autorskim); podajemy źródło: rozporządzenie i susza.iung.pulawy.pl                                                                                       |
| Definicja upału (Tmax > 30°C)              | słownik IMGW-PIB                                                                    | przytaczamy definicję z podaniem źródła                                                                                                                                                                                                      |

Metody opublikowane (FAO-56, FAO-33, wzór Doroszewskiego–Górskiego, Saxton–Rawls 2006, klasyfikacja PTG 2008) są
zaimplementowane we własnym kodzie na podstawie publikacji; nie używamy cudzego kodu tych metod.

Aplikacja w działaniu nie używa modeli sztucznej inteligencji ani usług AI (zob. [README](../../README.md#użycie-ai));
jedynym modelem uczenia maszynowego w łańcuchu danych jest SoilGrids — gotowe mapy ISRIC, nie nasz model.
