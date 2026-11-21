# `@app/bdot-import`

Jednorazowy import hydrografii BDOT10k (GUGiK) do Postgresa z PostGIS. Dlaczego tak:
[ADR 0010](../../docs/architecture/decisions/0010-postgis-on-neon-for-hydrography.md).

```bash
bun run bdot:import                          # wszystkie klasy (z korzenia repo; DATABASE_URL z .env.local)
bun run bdot:import --layers ditches,canals  # wybrane klasy; zastępuje ich poprzednie dane
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

## Licencja i źródło

BDOT10k, Główny Urząd Geodezji i Kartografii — dane publiczne udostępniane bezpłatnie (podstawę prawną i brzmienie
licencji trzeba przytoczyć w README konkursowym po sprawdzeniu u źródła). W raporcie podajemy źródło i datę importu z `bdot_import`.
