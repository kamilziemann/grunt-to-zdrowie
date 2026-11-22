# Grunt to Zdrowie — README konkursowe (szkic)

> Szkic toru „serwer” (runda 6, 22.11.2026). Zawiera tylko fakty zapisane już w repozytorium; miejsca oznaczone
> **„do potwierdzenia”** trzeba sprawdzić przed oddaniem. Źródła faktów: [`docs/project-status.md`](../project-status.md),
> [`docs/validation.md`](../validation.md), strona „Jak liczymy” (`apps/web/messages/pl/method.json`),
> [`tools/bdot-import/README.md`](../../tools/bdot-import/README.md), ADR-y w
> [`docs/architecture/decisions/`](../architecture/decisions), dzienniki w [`docs/progress/`](../progress).

## Zadanie i rozwiązanie

Zadanie KOWR „Zatrzymaj wodę, chroń plony” (HackNation 2026): aplikacja webowa dla rolnika, który nie zna GIS.
Rolnik wskazuje działkę ewidencyjną (numer albo mapa), wybiera uprawę i datę, a aplikacja **oblicza** raport
o sytuacji wodnej pola: ocena → przyczyny niedoboru → retencja → agrotechnika → ewentualne nawadnianie, ze źródłami
danych, datami pobrania i ograniczeniami. Nikt nie wpisuje gotowej diagnozy — raport liczy się od nowa z danych
publicznych dla wskazanego pola i dnia (dowolna data z ostatnich 10 lat).

## Ścieżka jury: numer działki → uprawa → data → raport

1. **Działka.** Na stronie `/` jedno pole wyszukiwania przyjmuje pełny numer działki (np. `080904_5.0001.349/1`),
   „obręb numer” (lista kandydatów z gminą i powiatem — nigdy nie wybieramy pierwszego automatycznie) albo adres.
   Działkę można też kliknąć na mapie (warstwa „Granice działek”). Można wybrać kilka działek albo narysować własne
   pole / podzielić działkę linią.
2. **Uprawa i data.** Strona `/analiza`: katalog 15 upraw z kalendarzem Kc i data z ostatnich 10 lat.
3. **Raport.** `/raport`: ocena z pewnością (wysoka/średnia/niska) → historia 10 sezonów i kalendarz ryzyka →
   przyczyny z dowodami liczbowymi → zalecenia retencyjne, agrotechniczne i nawadnianie → miejsca na polu (strefy) →
   źródła i ograniczenia. Wydruk A4, eksport CSV/JSON dla doradcy, raport otwiera się z linku.

Odporność ścieżki: granice działki pobieramy z ULDK GUGiK, a gdy ULDK zawiedzie albo przytnie limit (nocny limit
40 zapytań/min na IP) — z zapasowej usługi WFS ewidencji gruntów. Działka raz pobrana trafia do pamięci w bazie D1
na 30 dni; gdy GUGiK nie odpowiada, oddajemy wpis z pamięci (także starszy, z datą pobrania). Identyczne zapytanie
o raport wraca z zapisu w D1, a odpowiedzi źródeł (NASA POWER, SoilGrids, Copernicus) są zapamiętywane.

Czas analizy (pomiary wykonawców na lokalnym serwerze, 22.11.2026): pole rysowane, nigdy wcześniej nieliczone —
2,6 s (2 ha), 2,6 s (15 ha), 3,3 s (60 ha); pierwsza analiza działki po numerze z pobraniem granic i ewidencji —
3,7–6,3 s; powtórka z zapisu — kilkanaście milisekund. Wymóg konkursu: preferowany czas do 30 s.

## Źródła danych

Licencje jak na stronie „Jak liczymy” (`/jak-liczymy`). Data danych w każdym raporcie: `sources[].fetchedAt`
(dla BDOT10k — data importu z rejestru `bdot_import`).

| Dane                                     | Źródło                                                | Licencja (wg „Jak liczymy”)                                                                         | Uwagi                                                                     |
| ---------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Pogoda dobowa z 10 lat                   | NASA POWER                                            | CC BY 4.0 (NASA Langley Research Center, POWER Project)                                             | siatka ok. 50 km (0,5° × 0,625°)                                          |
| Prognoza na 7 dni (analiza „na dziś”)    | MET Norway                                            | CC BY 4.0 (Norwegian Meteorological Institute)                                                      |                                                                           |
| Progi suszy dla upraw i kategorii gleby  | IUNG-PIB, monitoring suszy rolniczej                  | tabela progów KBW (na zlecenie MRiRW); serwis nie podaje osobnej licencji — progi z podaniem źródła | **do potwierdzenia**: zgoda/licencja na użycie tabeli                     |
| Skład gleby, zapas wody, kategoria gleby | SoilGrids (ISRIC)                                     | CC BY 4.0 (ISRIC – World Soil Information)                                                          | model 250 m                                                               |
| Rowy, cieki, wody, mokradła; otoczenie   | BDOT10k, GUGiK                                        | bezpłatne i do dowolnego wykorzystania (od 31 lipca 2020 r.); regulamin Geoportalu wymaga źródła    | import do PostGIS (Neon) 21.11.2026; **do potwierdzenia** podstawa prawna |
| Zieloność i wilgotność roślin            | Copernicus Sentinel-2 (API statystyk Copernicus)      | otwarte dane Copernicus („zawiera zmodyfikowane dane Copernicus Sentinel”)                          | wymaga darmowego konta Copernicus Data Space                              |
| Ukształtowanie terenu                    | Terrain Tiles (AWS Open Data, terrarium): EU-DEM/SRTM | dane otwarte; podać EU-DEM (Copernicus), SRTM (NASA), opracowanie kafli Mapzen / AWS                | **do potwierdzenia**: brzmienie licencji (brak na stronie „Jak liczymy”)  |
| Granice, powierzchnia, klasy użytków     | ULDK i EGiB (zbiorcza usługa WFS), GUGiK              | dane publiczne GUGiK, bezpłatne, z podaniem źródła                                                  | ULDK: 200 zapytań/min w dzień, 40/min w godz. 18–6 (na IP)                |
| Zdjęcie lotnicze                         | Ortofotomapa GUGiK (WMS)                              | bezpłatna i do dowolnego wykorzystania; regulamin Geoportalu wymaga podania źródła                  |                                                                           |
| Podkład mapy, wyszukiwanie adresów       | OpenStreetMap (OpenFreeMap, Nominatim)                | ODbL (© autorzy OpenStreetMap)                                                                      | Nominatim ok. 1 zapytanie/s                                               |

Do potwierdzenia przed oddaniem: definicja upału z IMGW-PIB (próg > 30°C) pochodzi ze słownika IMGW
(<https://imgw.pl/edukacja/slowniki-hydrologiczno-meteorologiczne/>) — to definicja, nie dane, ale warto ją
przytoczyć ze źródłem.

## Metody

- **Ocena: klimatyczny bilans wodny (KBW) wg IUNG** — opad minus ewapotranspiracja potencjalna (wzór
  Doroszewskiego–Górskiego, usłonecznienie z promieniowania równaniem Ångströma), 6 dekad do daty analizy,
  14 okresów 21.III–30.IX, progi z tabeli IUNG dla grup upraw i 4 kategorii gleby. Parowanie podpisujemy jako
  oszacowanie (usłonecznienie odtwarzane z promieniowania). Kategoria gleby do progu: lżejszy koniec zakresu
  z modelu (uzasadnienie w [`docs/validation.md`](../validation.md)); bez kategorii gleby werdykt jest pewny tylko,
  gdy wszystkie kategorie dają ten sam wynik.
- **Bilans strefy korzeniowej FAO-56** — ET₀ Penman–Monteith, pojedynczy Kc z kalendarza uprawy, TAW/RAW, Ks;
  dni stresu i brakujące milimetry. Poziom „ryzyko” z bilansu wymaga niedoboru ewapotranspiracji uprawy ≥ 20%
  w 60 dniach (kryterium IUNG: spadek plonu o 20% w 6 dekadach; Ky ≈ 1 wg FAO-33).
- **Historia** — te same rachunki dla 10 sezonów przed rokiem analizy; rok analizy jest „bieżący” i liczony osobno.
- **Satelita jako potwierdzenie** — NDVI i NDMI z API statystyk Copernicus Data Space, maska chmur SCL, porównanie
  z tą samą porą roku w 5 poprzednich latach; o stresie wodnym mówimy tylko, gdy wilgotność roślin jest wyraźnie
  niższa niż zwykle **i** bilans pokazuje niedobór.
- **Gleba** — uziarnienie SoilGrids → grupa PTG 2008 → kategoria IUNG; zapas wody Saxton–Rawls (2006) dla 0–100 cm;
  gdy w polu brak predykcji — najbliższe piksele w promieniu do 2 km.
- **Strefy na polu** — siatka 10 m z jednego zdjęcia Sentinel-2 (wilgotność i kondycja roślin), terenu i rowów:
  2–5 stref z obrysem, powierzchnią i opisem; pola poniżej 0,5 ha stref nie dostają.
- **Przyczyny** — jawne reguły z dowodem liczbowym i wagą: mniej deszczu albo więcej parowania niż zwykle (na tle
  10 lat), gleba słabo trzymająca wodę, rów przy polu lub przez pole, brak stawów i mokradeł w okolicy, spływ po
  stoku, uprawa często cierpiąca na suszę. Dni upalne (temperatura maksymalna > 30°C, IMGW-PIB) są dowodem
  objaśniającym, nie składnikiem oceny (upał jest już w parowaniu).
- **Zalecenia** — każde odpowiada na przyczynę, kolejność stała: zatrzymaj wodę (zastawka na rowie, ochrona
  mokradła, oczko wodne, pas trawiasty, zadrzewienia) → uprawa (mulcz, materia organiczna, międzyplon, uprawa
  uproszczona, dobór uprawy) → nawadnianie tylko, gdy woda dostępna dla korzeni się kończy. Otoczenie pola z BDOT10k
  (drzewa przy granicy, jazy i wały, obszary chronione, polder) zmienia zalecenia i dopiski. Przy zastawce i oczku
  raport mówi o formalnościach (zgłoszenie albo pozwolenie wodnoprawne) i odsyła do Wód Polskich lub spółki wodnej.

## Walidacja

[`docs/validation.md`](../validation.md): 21 przypadków z komunikatów i wykazów gmin IUNG (System Monitoringu Suszy
Rolniczej), 8 z suszą i 13 bez. Wynik (silnik 0.4.0–0.7.0, bez zmian): **zgodność poziomu 21/21** (alarm przy
suszy 8/8, brak alarmu bez suszy 13/13), **zgodność KBW 20/21**, „obserwuj” bez suszy 9/13, werdykty dla kategorii
gleby zgodne z wykazem gminy 60/64. Rozbieżności i ich przyczyny (siatka NASA POWER, punkt zamiast gminy, gleba
z modelu) są opisane w tym samym pliku; 21 przypadków to nadal mało (brak gór i Żuław w zestawie).

## Ograniczenia

- Pogoda z siatki ok. 50 km — lokalna burza albo lokalny upał mogą być niewidoczne lub wygładzone.
- Gleba z modelu 250 m, często myli się o jedną kategorię — raport pokazuje, czy inna kategoria zmieniłaby ocenę.
- Nie mierzymy wilgotności na polu; najpewniejszy sprawdzian to łopata i ręka.
- Granice działek są dzisiejsze — także dla analiz sprzed kilku lat.
- Wiemy, gdzie są rowy na mapie, ale nie czy są drożne; mapy nie pokazują zastawek ani przepustów.
- Model terenu ok. 30 m — na małym polu spadek to przybliżenie.
- Usługa zbiorcza WFS nie podaje klasoużytków w części powiatów.

## Uruchomienie lokalne

```bash
bun install                                              # zależności + hooki gita (lefthook)
cp apps/web/.dev.vars.example apps/web/.dev.vars         # lokalne sekrety Workera (żaden nie jest wymagany)
bun run setup:local                                      # lokalna baza D1: migracje
bun run dev                                              # jeden serwer: strony + API (vite dev w workerd)
```

- Aplikacja: <http://localhost:3000>, API: <http://localhost:3000/api> (OpenAPI: `/api/docs`).
- Pełne dane wymagają sekretów w `apps/web/.dev.vars`: `DATABASE_URL` (Postgres z PostGIS z zaimportowanym BDOT10k,
  `bun run bdot:import`) i `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET` (darmowe konto Copernicus Data
  Space). Bez nich raport powstaje, a brakujące źródło jest opisane wprost w `sources` i ograniczeniach.
- Kontrola jakości: `bun check` (format, lint, granice architektury, dokumentacja, typy, testy), `bun db:check`.

## Technologia

Jeden Worker Cloudflare (`apps/web`): strony TanStack Start (React 19, SSR) i API Hono pod `/api`
([ADR 0008](../architecture/decisions/0008-tanstack-start-single-worker.md)); mapa MapLibre GL
([ADR 0009](../architecture/decisions/0009-field-style-and-maplibre.md)); D1 na raporty i pamięć działek
([ADR 0001](../architecture/decisions/0001-d1-instead-of-postgres.md)); PostGIS na Neon dla BDOT10k
([ADR 0010](../architecture/decisions/0010-postgis-on-neon-for-hydrography.md)); kontrakty Zod w
`packages/contracts` wspólne dla API i stron.

## Do uzupełnienia przed oddaniem

- Adres wdrożenia (O1) — **do potwierdzenia**.
- Prezentacja PDF (do 10 slajdów), film do 3 minut, przykładowe raporty (wymogi regulaminu).
- Licencje oznaczone „do potwierdzenia” (IUNG, BDOT10k — podstawa prawna, Terrain Tiles).
