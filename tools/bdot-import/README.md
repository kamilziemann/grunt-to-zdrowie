# `@app/bdot-import`

Jednorazowy import BDOT10k (GUGiK) do Postgresa z PostGIS: woda (rowy, cieki, wody, mokradła) oraz otoczenie pola
(drzewa, miejsca na sieci wodnej, obszary chronione). Dlaczego tak:
ADR 0010.

```bash
bun run bdot:import                          # wszystkie klasy (z korzenia repo; DATABASE_URL z .env.local)
bun run bdot:import --layers ditches,canals  # wybrane klasy; zastępuje ich poprzednie dane
bun run bdot:import --layers forests,levees  # klasy otoczenia; indeks zdejmowany tylko z tabel, do których trwa import
bun run bdot:import --limit 20000 --dry-run  # sam odczyt i przeliczenie, bez bazy
```

## Co trafia do bazy

Tabela `bdot_hydro`: `kind smallint`, `name text` (nazwa własna, gdy jest), `geom geometry(Geometry, 2180)` — układ
PL-1992, współrzędne w metrach; indeks GiST `bdot_hydro_geom_idx`. Tabela `bdot_import`: `layer`, `source_url`,
`features`, `tolerance_m`, `imported_at`.

| `kind` | Znaczenie                      | Klasa BDOT10k | Geometria | Klasa w skrypcie |
| ------ | ------------------------------ | ------------- | --------- | ---------------- |
| 1      | rów melioracyjny               | `OT_SWRM_L`   | linia     | `ditches`        |
| 2      | rzeka                          | `OT_SWRS_L`   | linia     | `watercourses`   |
| 3      | strumień, potok, struga        | `OT_SWRS_L`   | linia     | `watercourses`   |
| 4      | kanał                          | `OT_SWKN_L`   | linia     | `canals`         |
| 5      | woda stojąca (jezioro, staw)   | `OT_PTWP_A`   | poligon   | `waters`         |
| 6      | woda płynąca (koryto szerokie) | `OT_PTWP_A`   | poligon   | `waters`         |
| 7      | teren podmokły                 | `OT_OIMK_A`   | poligon   | `wetlands`       |
| 8      | bagno                          | `OT_OIMK_A`   | poligon   | `wetlands`       |

Pomijamy odcinki „pod powierzchnią” (rowy i cieki w rurach) oraz wody morskie. Geometrie są uproszczone z tolerancją
2 m (`--tolerance`).

### Otoczenie pola: trzy tabele według sposobu użycia

Tabele są dzielone według tego, **jak pyta o nie aplikacja**, a nie według klas BDOT10k. Wszystkie mają te same
kolumny co `bdot_hydro` (`kind`, `name`, `geom` w EPSG:2180) i własny indeks GiST `<tabela>_geom_idx`. Kod `kind` jest
unikalny we wszystkich tabelach — sam mówi, czym jest obiekt.

| Tabela            | Co trzyma                                                    | Jak jest pytana                                                |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| `bdot_hydro`      | otwarta woda: rowy, cieki, kanały, wody, mokradła            | kafle mapy, „najbliższy rów” i długość rowów w polu (500 m)    |
| `bdot_cover`      | drzewa: lasy, zadrzewienia, rzędy drzew, żywopłoty           | osłona pola (granica z drzewami, 200–500 m), warstwa mapy      |
| `bdot_waterworks` | miejsca na sieci wodnej: budowle, wały, rury, ujęcia, źródła | małe zbiory szukane w promieniu kilku km, argumenty do zaleceń |
| `bdot_protected`  | obszary chronione, pocięte na kawałki do 256 wierzchołków    | tylko „czy pole leży w obszarze” (`ST_Intersects`)             |

Dlaczego osobno: 2,7 mln obiektów drzew w jednej tabeli z jazami sprawiało, że szukanie jazu w 3 km przeglądało
wszystkie lasy w tym promieniu; kafle hydrografii nie powinny rosnąć po włączeniu lasów; duże poligony obszarów
chronionych bez cięcia mają prostokąty obejmujące pół powiatu, więc indeks niczego nie odsiewa.

| `kind` | Znaczenie                        | Tabela            | Klasa BDOT10k            | Geometria       | Klasa w skrypcie     | Uproszczenie |
| ------ | -------------------------------- | ----------------- | ------------------------ | --------------- | -------------------- | ------------ |
| 20     | las                              | `bdot_cover`      | `OT_PTLZ_A`              | poligon         | `forests`            | 5 m          |
| 21     | zagajnik                         | `bdot_cover`      | `OT_PTLZ_A`              | poligon         | `forests`            | 5 m          |
| 22     | zadrzewienie                     | `bdot_cover`      | `OT_PTLZ_A`              | poligon         | `forests`            | 5 m          |
| 23     | rząd drzew                       | `bdot_cover`      | `OT_OIPR_L`              | linia           | `tree-rows`          | 2 m          |
| 24     | pas krzewów lub żywopłot         | `bdot_cover`      | `OT_OIPR_L`              | linia           | `tree-rows`          | 2 m          |
| 30     | jaz                              | `bdot_waterworks` | `OT_BUHD_L`, `OT_BUHD_A` | linia / poligon | `structures`         | 2 m          |
| 31     | zapora                           | `bdot_waterworks` | `OT_BUHD_L`, `OT_BUHD_A` | linia / poligon | `structures`         | 2 m          |
| 32     | śluza                            | `bdot_waterworks` | `OT_BUHD_L`, `OT_BUHD_A` | linia / poligon | `structures`         | 2 m          |
| 33     | ujęcie wody                      | `bdot_waterworks` | `OT_BUIT_P`              | punkt           | `intakes`            | —            |
| 34     | źródło (z nazwą, gdy jest)       | `bdot_waterworks` | `OT_OIPR_P`              | punkt           | `springs`            | —            |
| 40     | wał przeciwpowodziowy lub grobla | `bdot_waterworks` | `OT_BUZM_L`              | linia           | `levees`             | 2 m          |
| 41     | rów w rurze (pod powierzchnią)   | `bdot_waterworks` | `OT_SWRM_L`              | linia           | `piped-ditches`      | 2 m          |
| 42     | ciek w rurze                     | `bdot_waterworks` | `OT_SWRS_L`              | linia           | `piped-watercourses` | 2 m          |
| 43     | kanał w rurze                    | `bdot_waterworks` | `OT_SWKN_L`              | linia           | `piped-canals`       | 2 m          |
| 50     | obszar Natura 2000 (z nazwą)     | `bdot_protected`  | `OT_TCON_A`              | poligon         | `natura2000`         | 20 m         |
| 51     | park krajobrazowy (z nazwą)      | `bdot_protected`  | `OT_TCPK_A`              | poligon         | `landscape-parks`    | 20 m         |
| 52     | park narodowy (z nazwą)          | `bdot_protected`  | `OT_TCPN_A`              | poligon         | `national-parks`     | 20 m         |
| 53     | rezerwat przyrody (z nazwą)      | `bdot_protected`  | `OT_TCRZ_A`              | poligon         | `nature-reserves`    | 20 m         |

Uwagi do umowy:

- **Odcinki w rurach (41–43) nie są w `bdot_hydro`** — „najbliższy rów” i kafle wody liczą się tylko z odcinków na
  powierzchni. Miejsce, w którym otwarty rów styka się z odcinkiem w rurze (zwykle pod drogą), to naturalny punkt
  piętrzenia: `ST_DWithin(rów.geom, rura.geom, 5)` między `bdot_hydro` (kind 1) a `bdot_waterworks` (kind 41).
- **Zastawek i przepustów BDOT10k (schemat 2021) nie wyróżnia**: klasa budowli hydrotechnicznych zna tylko jaz,
  zaporę i śluzę, a budowle inżynierskie (`OT_BUIN_L`) to mosty, kładki, wiadukty i tunele. Raport może powiedzieć
  „na tym cieku jest jaz X m dalej”, ale nie „na tym rowie jest już zastawka” — to ograniczenie trzeba pokazać wprost.
- **Pojedynczych drzew** z `OT_OIPR_P` (8 mln punktów) nie importujemy — z tej klasy bierzemy tylko źródła.
- Pomijamy obiekty zniszczone i w budowie (budowle, wały, ujęcia), nasypy i suche wykopy, linie oddziałowe w lesie.
- Obszar chroniony to wiele wierszy o tej samej nazwie (granice powiatów w BDOT10k + cięcie przy imporcie) — pytaj o
  `distinct name`. Powierzchni obszaru nie da się policzyć z jednego wiersza.
- `bdot_import` jest wspólnym rejestrem: `layer` (klucz), `table_name`, `source_url`, `features`, `tolerance_m`,
  `imported_at`. Datę danych dla raportu bierz dla konkretnej tabeli (`where table_name = 'bdot_hydro'`), nie `max`
  z całego rejestru.

## Zapytanie dla pola

Pole przychodzi jako GeoJSON w WGS84; odległości liczymy od poligonu, w metrach:

```sql
with field as (
  select ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 2180) as geom
)
select h.kind,
       count(*) as features,
       min(ST_Distance(h.geom, field.geom)) as nearest_m,
       (array_agg(h.name order by ST_Distance(h.geom, field.geom)) filter (where h.name is not null))[1] as nearest_name
from bdot_hydro h, field
where ST_DWithin(h.geom, field.geom, 500)
group by h.kind;
```

Brak wiersza dla danego rodzaju znaczy „nie ma zmapowanego obiektu w 500 m”, a nie „brak danych”.

Tabele otoczenia pyta się tak samo, każdą osobnym prostym zapytaniem ze **stałym promieniem** (promień zależny od
wiersza, np. `case when kind … then 3000 else 500 end`, wyłącza indeks — 2 s zamiast kilkudziesięciu milisekund):

```sql
with field as (
  select ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 2180) as geom
)
-- miejsca na sieci wodnej w 3 km: jaz, zapora, sluza, ujecie, zrodlo, wal, odcinki w rurach
select w.kind, count(*) as features, min(ST_Distance(w.geom, field.geom)) as nearest_m
from bdot_waterworks w, field
where ST_DWithin(w.geom, field.geom, 3000)
group by w.kind;

-- obszary chronione, w ktorych lezy pole (albo jego czesc)
select distinct p.kind, p.name
from bdot_protected p, field
where ST_Intersects(p.geom, field.geom);

-- ile granicy pola ma drzewa w pasie 15 m (do zalecenia "pas zadrzewien")
select ST_Length(ST_Intersection(ST_Boundary(field.geom), ST_Buffer(ST_Union(c.geom), 15))) as wooded_edge_m
from bdot_cover c, field
where ST_DWithin(c.geom, field.geom, 15)
group by field.geom;
```

## Licencja i źródło

BDOT10k, Główny Urząd Geodezji i Kartografii — dane publiczne udostępniane bezpłatnie (podstawę prawną i brzmienie
licencji trzeba przytoczyć w README konkursowym po sprawdzeniu u źródła). W raporcie podajemy źródło i datę importu z `bdot_import`.
