# `@app/bdot-import`

Jednorazowy import BDOT10k (GUGiK) do Postgresa z PostGIS: woda (rowy, cieki, wody, mokradła) oraz otoczenie pola
(lasy i zadrzewienia, budowle piętrzące, wały, obszary chronione). Dlaczego tak:
[ADR 0010](../../docs/architecture/decisions/0010-postgis-on-neon-for-hydrography.md).

```bash
bun run bdot:import                          # wszystkie klasy (z korzenia repo; DATABASE_URL z .env.local)
bun run bdot:import --layers ditches,canals  # wybrane klasy; zastępuje ich poprzednie dane
bun run bdot:import --layers forests,levees  # klasy otoczenia; tabela wody i jej indeks zostają nietknięte
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

### Otoczenie pola: tabela `bdot_context`

Te same kolumny co `bdot_hydro` (`kind`, `name`, `geom` w EPSG:2180) i indeks GiST `bdot_context_geom_idx`. Osobna
tabela, żeby półtora miliona poligonów lasów nie spowalniało kafli hydrografii. Kody zaczynają się od 20 — nie
pokrywają się z kodami wody.

| `kind` | Znaczenie                        | Klasa BDOT10k            | Geometria       | Klasa w skrypcie  | Uproszczenie |
| ------ | -------------------------------- | ------------------------ | --------------- | ----------------- | ------------ |
| 20     | las                              | `OT_PTLZ_A`              | poligon         | `forests`         | 5 m          |
| 21     | zagajnik                         | `OT_PTLZ_A`              | poligon         | `forests`         | 5 m          |
| 22     | zadrzewienie                     | `OT_PTLZ_A`              | poligon         | `forests`         | 5 m          |
| 23     | rząd drzew                       | `OT_OIPR_L`              | linia           | `tree-rows`       | 2 m          |
| 24     | pas krzewów lub żywopłot         | `OT_OIPR_L`              | linia           | `tree-rows`       | 2 m          |
| 30     | jaz                              | `OT_BUHD_L`, `OT_BUHD_A` | linia / poligon | `structures`      | 2 m          |
| 31     | zapora                           | `OT_BUHD_L`, `OT_BUHD_A` | linia / poligon | `structures`      | 2 m          |
| 32     | śluza                            | `OT_BUHD_L`, `OT_BUHD_A` | linia / poligon | `structures`      | 2 m          |
| 40     | wał przeciwpowodziowy lub grobla | `OT_BUZM_L`              | linia           | `levees`          | 2 m          |
| 50     | obszar Natura 2000 (z nazwą)     | `OT_TCON_A`              | poligon         | `natura2000`      | 20 m         |
| 51     | park krajobrazowy (z nazwą)      | `OT_TCPK_A`              | poligon         | `landscape-parks` | 20 m         |
| 52     | park narodowy (z nazwą)          | `OT_TCPN_A`              | poligon         | `national-parks`  | 20 m         |
| 53     | rezerwat przyrody (z nazwą)      | `OT_TCRZ_A`              | poligon         | `nature-reserves` | 20 m         |

Czego tu nie ma i dlaczego:

- **Zastawek i przepustów** — BDOT10k (schemat 2021) ich nie wyróżnia: klasa budowli hydrotechnicznych zna tylko jaz,
  zaporę i śluzę, a budowle inżynierskie (`OT_BUIN_L`) to mosty, kładki, wiadukty i tunele. Raport może więc
  powiedzieć „na tym cieku jest jaz X m dalej”, ale nie „na tym rowie jest już zastawka”.
- **Pojedynczych drzew** (`OT_OIPR_P`, 8 mln punktów) — nie zmieniają zaleceń, a potroiłyby tabelę.
- Obiektów zniszczonych i w budowie (budowle, wały); nasypów i suchych wykopów z klasy budowli ziemnych; linii
  oddziałowych, progów skalnych i wodospadów z klasy obiektów przyrodniczych.

Obszar chroniony bywa pocięty granicami powiatów na kilka wierszy o tej samej nazwie — pytaj o `distinct name`.

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

Dla `bdot_context` wzór jest ten sam, ale **promień musi być stałą w każdym podzapytaniu** — promień zależny od
wiersza (`case when kind … then 3000 else 500 end`) wyłącza indeks i zapytanie trwa 2 s zamiast 40–300 ms:

```sql
with field as (
  select ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 2180) as geom
),
near as (
  -- lasy, zadrzewienia, rzedy drzew: najblizsze otoczenie pola
  select c.kind, c.name, ST_Distance(c.geom, field.geom) as distance_m
  from bdot_context c, field
  where c.kind < 30 and ST_DWithin(c.geom, field.geom, 500)
  union all
  -- jazy, zapory, sluzy, waly: szukamy dalej, bo pietrza wode na calym odcinku cieku
  select c.kind, c.name, ST_Distance(c.geom, field.geom)
  from bdot_context c, field
  where c.kind between 30 and 40 and ST_DWithin(c.geom, field.geom, 3000)
  union all
  -- obszary chronione: liczy sie tylko to, czy pole w nich lezy
  select c.kind, c.name, 0
  from bdot_context c, field
  where c.kind >= 50 and ST_Intersects(c.geom, field.geom)
)
select kind, count(*) as features, min(distance_m) as nearest_m,
       array_agg(distinct name) filter (where name is not null) as names
from near
group by kind;
```

Udział granicy pola z drzewami (do zalecenia „pas zadrzewień”): długość
`ST_Intersection(ST_Boundary(field.geom), ST_Buffer(c.geom, 15))` dla `kind between 20 and 24` — bufory sąsiednich
obiektów nachodzą na siebie, więc przed sumowaniem trzeba je złączyć (`ST_Union`).

## Licencja i źródło

BDOT10k, Główny Urząd Geodezji i Kartografii — dane publiczne udostępniane bezpłatnie (podstawę prawną i brzmienie
licencji trzeba przytoczyć w README konkursowym po sprawdzeniu u źródła). W raporcie podajemy źródło i datę importu z `bdot_import`.
