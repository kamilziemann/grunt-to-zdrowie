# Grunt to Zdrowie — README konkursowe

> Rozszerzenie głównego [`README.md`](../../README.md) (tam skrót wszystkich wymaganych punktów, w tym użycie AI)
> o szczegóły: ścieżkę jury, źródła, metody, weryfikację, koszty, skalę i bezpieczeństwo. Stan na 22.11.2026, silnik
> analizy **0.8.8**; wszystkie źródła raportu są prawdziwe (`meta.sample: false`, bez części przykładowych). Fakty
> z repozytorium, a ceny, limity i licencje sprawdzone u źródła 22.11.2026 (adresy obok); miejsca oznaczone **„do
> potwierdzenia”** trzeba sprawdzić przed oddaniem. Wykaz bibliotek i licencji: [`licencje.md`](licencje.md). Źródła faktów:
> [`docs/validation.md`](../validation.md), strona „Jak liczymy” (`apps/web/messages/pl/method.json`),
> [`tools/bdot-import/README.md`](../../tools/bdot-import/README.md).

## Zadanie i rozwiązanie

Zadanie KOWR „Zatrzymaj wodę, chroń plony” (HackNation 2026): aplikacja webowa dla rolnika, który nie zna GIS.
Rolnik wskazuje działkę ewidencyjną (numer albo mapa), wybiera uprawę i datę, a aplikacja **oblicza** raport
o sytuacji wodnej pola: ocena → przyczyny niedoboru → retencja → agrotechnika → ewentualne nawadnianie, ze źródłami
danych, datami pobrania i ograniczeniami. Nikt nie wpisuje gotowej diagnozy — raport liczy się od nowa z danych
publicznych dla wskazanego pola i dnia (dowolna data z ostatnich 10 lat).

**Działająca wersja:** <https://grunt-to-zdrowie.hoxu.workers.dev> (jeden Worker Cloudflare: strony i API pod
`/api`, dokumentacja API: `/api/docs`).

## Ścieżka jury: numer działki → uprawa → data → raport

1. **Działka.** Na stronie `/` jedno pole wyszukiwania przyjmuje pełny numer działki (np. `080904_5.0001.349/1`),
   „obręb numer” (lista kandydatów z gminą i powiatem — nigdy nie wybieramy pierwszego automatycznie) albo adres.
   Działkę można też kliknąć na mapie (warstwa „Granice działek”). Można wybrać kilka działek albo narysować własne
   pole / podzielić działkę linią.
2. **Uprawa i data.** Strona `/analiza`: katalog 15 upraw z kalendarzem Kc i data z ostatnich 10 lat.
3. **Raport.** `/raport`: ocena z pewnością (wysoka/średnia/niska) → historia 10 sezonów i kalendarz ryzyka →
   przyczyny z dowodami liczbowymi → zalecenia retencyjne, agrotechniczne i nawadnianie → miejsca na polu (strefy) →
   źródła i ograniczenia. Wydruk A4, eksport CSV/JSON dla doradcy, raport otwiera się z linku. Od silnika 0.8.0
   (obecnie 0.8.8) raport niesie też dane „Pogodynki wody”: zbiornik wody w glebie (ile procent zostało, ile zwykle, za ile dni bez
   deszczu zacznie się stres), prognozę na 7 dni, rachunek wody od 21 marca, ostatnie 60 dni dzień po dniu i zdjęcia
   satelitarne z ostatnich 30 dni (także pominięte przez chmury).

Odporność ścieżki: granice działki pobieramy z ULDK GUGiK, a gdy ULDK zawiedzie albo przytnie limit (nocny limit
40 zapytań/min na IP) — z zapasowej usługi WFS ewidencji gruntów. Działka raz pobrana trafia do pamięci w bazie D1
na 30 dni; gdy GUGiK nie odpowiada, oddajemy wpis z pamięci (także starszy, z datą pobrania). Identyczne zapytanie
o raport wraca z zapisu w D1, a odpowiedzi źródeł (NASA POWER, SoilGrids, Copernicus) są zapamiętywane.

Czas analizy (pomiary wykonawców na lokalnym serwerze, 22.11.2026): pole rysowane, nigdy wcześniej nieliczone —
2,6 s (2 ha), 2,6 s (15 ha), 3,3 s (60 ha), 4,4 s (silnik 0.8.0, nowe miejsce w lubelskim); pierwsza analiza działki
po numerze z pobraniem granic i ewidencji — 3,7–6,3 s; powtórka z zapisu — kilkanaście milisekund. W chmurze
(wdrożenie, sprawdzenie integratora 22.11.2026): 4,6 s. Wymóg konkursu: preferowany czas do 30 s.

## Źródła danych

Licencje jak na stronie „Jak liczymy” (`/jak-liczymy`). Każdy raport podaje przy każdym źródle sposób pobrania
(`sources[].mode`: `live` = na bieżąco, `preloaded` = zaimportowane wcześniej) i datę (`sources[].fetchedAt`:
chwila pobrania albo — dla BDOT10k — chwila importu z rejestru `bdot_import`).

**Na bieżąco** (przy każdej analizie; odpowiedzi trzymamy krótko w pamięci podręcznej, niżej) pobieramy pogodę,
prognozę, glebę, teren, zdjęcia satelitarne, granice i ewidencję działki. **Wcześniej** zaimportowany jest tylko
BDOT10k: hydrografia 21.11.2026 (ok. 21:40) i otoczenie pola 22.11.2026 (ok. 00:07), import jednorazowy skryptem
`bun run bdot:import` do Postgresa z PostGIS
([`tools/bdot-import/README.md`](../../tools/bdot-import/README.md)). Progi IUNG są stałą tabelą w kodzie (z
rozporządzenia, sprawdzone ze stroną IUNG 21.11.2026).

| Dane                                     | Źródło                                                | Pobieranie                 | Licencja / podstawa                                                                                                                                                                                     | Uwagi                                                      |
| ---------------------------------------- | ----------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Pogoda dobowa z 10 lat                   | NASA POWER                                            | na bieżąco                 | CC BY 4.0 (NASA Langley Research Center, POWER Project)                                                                                                                                                 | siatka ok. 50 km (0,5° × 0,625°)                           |
| Prognoza na 7 dni (analiza „na dziś”)    | MET Norway Locationforecast 2.0                       | na bieżąco                 | CC BY 4.0 (Norwegian Meteorological Institute)                                                                                                                                                          | raport podaje chwilę wydania prognozy                      |
| Progi suszy dla upraw i kategorii gleby  | rozporządzenie MRiRW, publikowane przez IUNG-PIB      | tabela w kodzie            | rozporządzenie MRiRW z 11.04.2019 w sprawie wartości KBW (Dz.U. 2019 poz. 739); akt normatywny nie jest przedmiotem prawa autorskiego (art. 4 pkt 1 ustawy o prawie autorskim)                          | podajemy źródło: rozporządzenie i susza.iung.pulawy.pl     |
| Skład gleby, zapas wody, kategoria gleby | SoilGrids (ISRIC)                                     | na bieżąco                 | CC BY 4.0 (ISRIC – World Soil Information)                                                                                                                                                              | model 250 m                                                |
| Rowy, cieki, wody, mokradła; otoczenie   | BDOT10k, GUGiK                                        | wcześniej, 21–22.11.2026   | bezpłatne od 31.07.2020: art. 40a ust. 2 pkt 1 lit. h Prawa geodezyjnego i kartograficznego, dodany ustawą z 16.04.2020 (Dz.U. 2020 poz. 782); regulamin Geoportalu wymaga źródła                       | import do PostGIS (Neon); stan z dnia importu              |
| Zieloność i wilgotność roślin            | Copernicus Sentinel-2 (API statystyk Copernicus)      | na bieżąco                 | otwarte dane Copernicus („zawiera zmodyfikowane dane Copernicus Sentinel”)                                                                                                                              | wymaga darmowego konta Copernicus Data Space               |
| Ukształtowanie terenu                    | Terrain Tiles (AWS Open Data, terrarium): EU-DEM/SRTM | na bieżąco                 | bez jednej licencji kafli: atrybucja każdego źródła — „Produced using Copernicus data and information funded by the European Union - EU-DEM layers”, „SRTM data courtesy of the U.S. Geological Survey” | zasady: tilezen/joerd `docs/attribution.md`                |
| Granice, powierzchnia, klasy użytków     | ULDK i EGiB (zbiorcza usługa WFS), GUGiK              | na bieżąco (pamięć 30 dni) | dane publiczne GUGiK, bezpłatne, z podaniem źródła                                                                                                                                                      | ULDK: 200 zapytań/min w dzień, 40/min w godz. 18–6 (na IP) |
| Zdjęcie lotnicze                         | Ortofotomapa GUGiK (WMS)                              | na bieżąco (mapa)          | bezpłatna i do dowolnego wykorzystania; regulamin Geoportalu wymaga podania źródła                                                                                                                      |                                                            |
| Podkład mapy, wyszukiwanie adresów       | OpenStreetMap (OpenFreeMap, Nominatim)                | na bieżąco (mapa)          | ODbL (© autorzy OpenStreetMap)                                                                                                                                                                          | Nominatim ok. 1 zapytanie/s                                |

Adresy, pod którymi sprawdziliśmy podstawy (22.11.2026): rozporządzenie o KBW
<https://api.sejm.gov.pl/eli/acts/DU/2019/739>; ustawa o prawie autorskim, art. 4 (tekst jednolity Dz.U. 2022 poz. 2509) <https://api.sejm.gov.pl/eli/acts/DU/2022/2509/text.html>; nowelizacja Prawa geodezyjnego i kartograficznego
<https://api.sejm.gov.pl/eli/acts/DU/2020/782/text.html>; Terrain Tiles <https://registry.opendata.aws/terrain-tiles/>
i <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>.

Do potwierdzenia przed oddaniem: (1) dokładne brzmienie art. 40a ust. 2 pkt 1 Pgik („nie pobiera się opłat”) —
nowelizacja dodaje lit. h (obiekty topograficzne o szczegółowości map 1:10 000–1:100 000, czyli BDOT10k), ale tekstu
jednolitego nie udało się pobrać; (2) definicja upału z IMGW-PIB (próg > 30°C) pochodzi ze słownika IMGW
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
- **Udział przyczyn** — waga każdej przyczyny podzielona przez sumę wag (suma 100%); to szacunek wagi argumentu, nie
  pomiar, ile milimetrów wody zabrała dana przyczyna.
- **Zbiornik wody i rachunek wody** („Pogodynka wody”, silnik 0.8.0) — z tego samego bilansu FAO-56: procent wody
  dostępnej dla roślin w dniu analizy i mediana tego dnia w 10 latach tła; próg stresu (1 − p) · 100%; dni do
  stresu = kolejne dni z Kc uprawy × średnie ET₀ z ostatnich 7 dni (bez deszczu) albo z opadem i ET₀ z prognozy.
  Rachunek od 21 marca: zapas na starcie + opad − zużycie − przesiąkanie poniżej korzeni = zapas na koniec (zamyka
  się co do 0,1 mm); osobno niedobór względem potrzeb uprawy. Model nie liczy spływu po powierzchni.
- **Zalecenia** — każde odpowiada na przyczynę, kolejność stała: zatrzymaj wodę (zastawka na rowie, ochrona
  mokradła, oczko wodne, pas trawiasty, zadrzewienia) → uprawa (mulcz, materia organiczna, międzyplon, uprawa
  uproszczona, dobór uprawy) → nawadnianie tylko, gdy woda dostępna dla korzeni się kończy. Otoczenie pola z BDOT10k
  (drzewa przy granicy, jazy i wały, obszary chronione, polder) zmienia zalecenia i dopiski. Przy zastawce i oczku
  raport mówi o formalnościach (zgłoszenie albo pozwolenie wodnoprawne) i odsyła do Wód Polskich lub spółki wodnej.

## Jak weryfikujemy wyniki

1. **Porównanie z ogłoszeniami IUNG.** [`docs/validation.md`](../validation.md): 21 przypadków z komunikatów i
   wykazów gmin Systemu Monitoringu Suszy Rolniczej IUNG-PIB, 8 z suszą i 13 bez (te same gminy, uprawy i pory roku).
   Skrypt `bun run validate:iung -- --api <adres API>` liczy raporty przez prawdziwe API ze wszystkimi źródłami.
   Wynik (silnik 0.4.0–0.8.0, bez zmian; 0.8.1–0.8.8 zmieniły pewność, zaokrąglenia, odczyt satelity wg uprawy oraz przyczyny i zalecenia poza
   sezonem, nie rachunek oceny — powtórka na 0.8.8 z 22.11.2026 dała tę samą tabelę): **zgodność poziomu 21/21** (alarm przy suszy 8/8, brak alarmu bez suszy
   13/13), **zgodność KBW 20/21**, „obserwuj” bez suszy 9/13, werdykty dla każdej z czterech kategorii gleby zgodne
   z wykazem gminy **60/64**. Rozbieżności i ich przyczyny (siatka NASA POWER, punkt zamiast gminy, gleba z modelu)
   są opisane w tym samym pliku; 21 przypadków to nadal mało (brak gór i Żuław w zestawie).
2. **Progi i wzory sprawdzone ze źródłem.** Wszystkie 784 wartości progów KBW porównane ze stroną IUNG
   (21.11.2026); bilans strefy korzeniowej odtwarza przykłady 37 i 38 z FAO-56 (test jednostkowy, Ks, ETc adj i
   wyczerpanie co do publikacji).
3. **Testy przeliczone ręcznie.** Każda reguła silnika ma testy na przypadkach liczonych na kartce (np. zbiornik:
   TAW 150 mm, wyczerpanie 60 mm → 60%, stres po 5 dniach), także susza zakończona ulewą, uprawa poza sezonem, brak
   prognozy i luki w danych pogodowych. Rachunek wody ma test, że liczby się bilansują. Testy nie wołają sieci;
   cały zestaw (`bun check`) działa przy każdej zmianie.
4. **Kontrakt raportu.** Raport jest walidowany schematem Zod wspólnym dla API i stron; nowe pola są tylko dodawane,
   więc zapisane raporty starszych wersji silnika nadal się otwierają.
5. **Sprawdzenie na żywo.** Po każdej zmianie silnika liczymy kilka znanych działek przez lokalne API z prawdziwymi
   źródłami (np. `080904_5.0001.349/1`, pszenica ozima, 15.06.2018 — susza 2018) i porównujemy z wiedzą o sezonie.
6. **Czego nie weryfikujemy.** Nie mamy pomiarów wilgotności gleby w polu ani plonów z działek — wynik to model;
   raport mówi to wprost przy zbiorniku wody i w ograniczeniach.

## Ograniczenia

- Pogoda z siatki ok. 50 km — lokalna burza albo lokalny upał mogą być niewidoczne lub wygładzone.
- Gleba z modelu 250 m, często myli się o jedną kategorię — raport pokazuje, czy inna kategoria zmieniłaby ocenę.
- Nie mierzymy wilgotności na polu; najpewniejszy sprawdzian to łopata i ręka.
- Granice działek są dzisiejsze — także dla analiz sprzed kilku lat.
- Wiemy, gdzie są rowy na mapie, ale nie czy są drożne; mapy nie pokazują zastawek ani przepustów.
- Model terenu ok. 30 m — na małym polu spadek to przybliżenie.
- Usługa zbiorcza WFS nie podaje klasoużytków w części powiatów.

## Infrastruktura i koszty (pkt 5.4)

Ceny i limity sprawdzone u źródła 22.11.2026; koszty miesięczne to nasze szacunki, nie oferta.

| Usługa                                   | Do czego                                         | Darmowo                                                                    | Płatnie                                                                                                                            | Źródło                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers                       | strony i API (jeden Worker)                      | 100 000 zapytań/dobę, 10 ms CPU na zapytanie                               | od 5 USD/mies.: 10 mln zapytań i 30 mln ms CPU w cenie, dalej 0,30 USD/mln zapytań i 0,02 USD/mln ms CPU; do 5 min CPU (dom. 30 s) | <https://developers.cloudflare.com/workers/platform/pricing/>, <https://developers.cloudflare.com/workers/platform/limits/> |
| Cloudflare D1                            | zapisane raporty, pamięć działek                 | 5 mln odczytów wierszy/dobę, 100 tys. zapisów/dobę, 5 GB; baza do 500 MB   | 25 mld odczytów i 50 mln zapisów/mies. w cenie Workers Paid, 5 GB w cenie, dalej 0,75 USD/GB-mies.; baza do 10 GB                  | <https://developers.cloudflare.com/d1/platform/pricing/>, <https://developers.cloudflare.com/d1/platform/limits/>           |
| Neon (Postgres + PostGIS)                | BDOT10k: woda i otoczenie pola (1447 MB)         | 100 CU-godz./projekt/mies., 1 GB na projekt — **za mało** na nasze 1,45 GB | plan Launch bez opłaty minimalnej: 0,106 USD/CU-godz., 0,35 USD/GB-mies.; usypianie po bezczynności                                | <https://neon.com/pricing>, <https://neon.com/docs/extensions/postgis>                                                      |
| Copernicus Data Space                    | zdjęcia Sentinel-2 (API statystyk i Process API) | konto ogólne: 10 000 PU i 10 000 zapytań/mies., 300 PU i 300 zapytań/min   | —                                                                                                                                  | <https://documentation.dataspace.copernicus.eu/Quotas.html>                                                                 |
| NASA POWER, MET Norway, SoilGrids, GUGiK | pogoda, prognoza, gleba, działki                 | bez opłat                                                                  | —                                                                                                                                  | regulaminy dostawców (tabela źródeł)                                                                                        |

**Szacunek kosztów** dzisiejszej wersji (ruch konkursowy): Workers Paid 5 USD/mies. (analiza liczy w Workerze dobowy
bilans 10 lat i siatkę terenu, więc limit 10 ms CPU planu darmowego jest za mały — **do potwierdzenia** pomiarem CPU
i planem konta wdrożenia); D1 w cenie Workers Paid; Neon Launch: przechowywanie ok. 1,45 GB × 0,35 USD ≈ 0,5 USD/mies.
plus czas pracy bazy (baza usypia; np. 0,25 CU przez 8 godz. dziennie ≈ 60 CU-godz. ≈ 6,4 USD/mies.). Razem rząd
wielkości **ok. 12 USD/mies.**

**Alternatywy:** Supabase (Postgres; plan darmowy 500 MB — za mało na BDOT10k, Pro od 25 USD/mies., 8 GB dysku;
<https://supabase.com/pricing>, obsługa PostGIS **do potwierdzenia** u źródła); własny serwer z Postgresem i PostGIS,
np. Hetzner Cloud CPX02 (1 vCPU, 1 GB RAM, 20 GB NVMe) 5,49–6,49 EUR/mies. netto + 0,50 EUR za IPv4
(<https://www.hetzner.com/cloud/regular-performance>) — taniej, ale kopie, aktualizacje i dostępność są wtedy po
naszej stronie; BDOT10k w plikach przy Workerze (R2) zamiast bazy — wymaga przebudowy zapytań przestrzennych.

## Skala: wielu rolników (pkt 5.5)

- **Pamięć odpowiedzi źródeł** (Workers Cache, w każdym centrum danych osobno): historia pogody i zdjęć 30 dni,
  ostatnie dni 3 godziny. Ta sama okolica liczona drugi raz nie pyta NASA POWER, SoilGrids ani Copernicus.
- **Pamięć działek** (D1): granice i ewidencja 30 dni; gdy GUGiK nie odpowiada, oddajemy starszy wpis z datą.
  Limit ULDK (200 zapytań/min w dzień, 40/min w nocy, na adres IP) przy wielu rolnikach naraz jest pierwszym wąskim
  gardłem — chronią przed nim pamięć działek i zapasowa usługa WFS ewidencji; przy dużym ruchu trzeba by uzgodnić
  limit z GUGiK albo zaimportować granice wcześniej (**do potwierdzenia** z GUGiK).
- **Zapis raportów** (D1): ten sam wniosek (pole, uprawa, data, wersja silnika) wraca z zapisu w milisekundach;
  raport „na dziś” liczy się od nowa po dobie (nowa pogoda i prognoza).
- **Copernicus**: jedna analiza to token + 6 zapytań statystyk + 1 zapytanie o mapę pola, więc darmowe konto
  (10 000 zapytań/mies.) wystarcza na ok. 1200–1400 analiz nowych miejsc miesięcznie; zużycia PU na analizę nie
  zmierzyliśmy (**do potwierdzenia**). Przy wielu rolnikach potrzebne jest konto z wyższym limitem albo własne
  przetwarzanie zdjęć.
- **Aktualizacja danych**: pogoda, prognoza, gleba, teren, zdjęcia i działki są pobierane przy analizie, więc są
  aktualne same. BDOT10k jest stanem z dnia importu — odświeżenie to ponowne `bun run bdot:import` (np. raz na
  kwartał; GUGiK aktualizuje bazę powiatami). Progi IUNG zmieniają się tylko z nowym rozporządzeniem.
- **Szybkość**: 2,6–6,3 s na nowe pole lokalnie, 4,6 s w chmurze; raport z zapisu — milisekundy. Worker skaluje się
  sam; baza Neon autoskaluje do 16 CU na planie Launch.
- **Koszty przy dużym ruchu**: rosną głównie Workers (CPU analizy) i Neon (czas pracy bazy); D1 i pamięć podręczna
  zmniejszają liczbę zapytań do źródeł zewnętrznych.

## Bezpieczeństwo (pkt 5.6)

- **Bez kont i danych osobowych**: nie ma logowania,
  sesji ani formularzy z danymi osoby. Numer działki i jej granice to publiczne dane ewidencji; zapisany raport ma
  identyfikator ze skrótu wniosku (pole, uprawa, data, wersja silnika).
- **Sekrety poza kodem**: `DATABASE_URL` (Neon) i klucze Copernicus są sekretami Workera (`wrangler secret put`),
  lokalnie w `apps/web/.dev.vars` (w `.gitignore`); środowisko jest walidowane schematem przy każdym zapytaniu, brak
  klucza = źródło opisane w raporcie jako niedostępne, a nie błąd.
- **Tylko odczyt danych zewnętrznych**: API nie przyjmuje plików ani zapisów poza zapisem własnego raportu;
  zapytania do bazy są parametryzowane (Drizzle, sterownik Neon).
- **Błędy i logi**: odpowiedzi błędów w formacie Problem Details bez szczegółów wewnętrznych; logi w Cloudflare
  Observability; raportowanie do Sentry domyślnie wyłączone.

## Uruchomienie lokalne

```bash
bun install                                              # zależności + hooki gita (lefthook)
cp apps/web/.dev.vars.example apps/web/.dev.vars         # lokalne sekrety Workera (żaden nie jest wymagany)
bun run setup:local                                      # lokalna baza D1: migracje
bun run dev                                              # jeden serwer: strony + API (vite dev w workerd)
```

Sprawdzone 22.11.2026 na świeżym klonie repozytorium, bez żadnych sekretów: `bun install` (ok. 4 s),
`bun run setup:local` (migracja `0000_init.sql`), `bun run dev` — strona odpowiada, analiza pola liczy się w ok. 2 s
ze statusem „częściowy” (bez BDOT10k i zdjęć satelitarnych, oba braki opisane w raporcie).

- Aplikacja: <http://localhost:3000>, API: <http://localhost:3000/api> (OpenAPI: `/api/docs`).
- Pełne dane wymagają sekretów w `apps/web/.dev.vars`: `DATABASE_URL` (Postgres z PostGIS z zaimportowanym BDOT10k,
  `bun run bdot:import`) i `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET` (darmowe konto Copernicus Data
  Space). Bez nich raport powstaje, a brakujące źródło jest opisane wprost w `sources` i ograniczeniach.
- Kontrola jakości: `bun check` (format, lint, granice architektury, dokumentacja, typy, testy), `bun db:check`.
- Lokalna baza sprzed 2026-11-22 ma starą historię migracji — usuń `apps/web/.wrangler/state` i uruchom
  `bun run setup:local` ponownie.

## Technologia

Jeden Worker Cloudflare (`apps/web`): strony TanStack Start (React 19, SSR) i API Hono pod `/api`;
mapa MapLibre GL; D1 na raporty i pamięć działek, bez kont; PostGIS na Neon dla BDOT10k; kontrakty Zod w
`packages/contracts` wspólne dla API i stron.

## Użycie AI, biblioteki i licencje

- Użycie AI (pkt 5.1): sekcja „Użycie AI” w głównym [`README.md`](../../README.md#użycie-ai). W skrócie: aplikacja
  w działaniu nie woła modeli AI ani LLM — ocenę, przyczyny i zalecenia liczą jawne reguły i modele fizyczne
  (KBW wg IUNG, FAO-56, Saxton–Rawls); SoilGrids to zewnętrzne mapy gleby z modelu uczenia maszynowego ISRIC. Przy
  budowie użyliśmy agentów programistycznych: Claude Code (modele Claude), Codex CLI i Antigravity CLI (research,
  testy na wdrożonej wersji, przeglądy).
- Biblioteki, komponenty, usługi i dane z wersjami i licencjami: [`licencje.md`](licencje.md).

## Do uzupełnienia przed oddaniem

- Link do repozytorium w głównym `README.md` (zespół: KDKZ).
- Prezentacja PDF (do 10 slajdów) i film do 3 minut — linki w głównym `README.md`. Raporty wzorcowe są w
  [`docs/samples/`](../samples/README.md) (silnik 0.8.8, odświeżone 22.11.2026).
- Zmierzony czas CPU analizy — **do potwierdzenia** (plan: Workers Paid i Neon Launch, potwierdzone przez zespół).
- Licencja kodu własnego (dziś `"private": true`, bez pliku licencji) i wersje modeli Codex / Antigravity.
- Licencje i podstawy oznaczone „do potwierdzenia” (brzmienie art. 40a Pgik, PostGIS w Supabase, zużycie PU
  Copernicus, uzgodnienie limitu z GUGiK przy dużym ruchu, licencja stylu OpenFreeMap „liberty”).
