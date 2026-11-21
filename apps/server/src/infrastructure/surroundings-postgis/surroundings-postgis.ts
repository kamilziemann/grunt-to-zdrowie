// Adapter SurroundingsSource na tabele otoczenia BDOT10k w PostGIS (Neon, ADR 0010 z aktualizacja 2026-11-22):
// bdot_cover (drzewa), bdot_waterworks (budowle, waly, zrodla, ujecia, odcinki w rurach), bdot_protected (obszary
// chronione). Szesc prostych zapytan tylko do odczytu w jednym wywolaniu HTTP, kazde ze STALYM promieniem (promien
// zalezny od wiersza wylacza indeks: 2 s zamiast 30-60 ms). Brak adresu bazy, limit czasu albo blad = `missing`.
import type { FieldArea, SourceRef, Surroundings } from '@app/contracts';

import type { LngLat, Sourced, SurroundingsSource } from '../../domain/analysis-ports';
import {
  SURROUNDINGS_RADII,
  surroundingsFromRows,
  WATERWORKS_CODES,
  type KindSummaryRow,
} from '../../domain/surroundings';
import { failureNote } from '../../lib/source-note';
import type { SqlQuery, SqlRunner } from '../hydro-postgis';

const PROVIDER = 'GUGiK BDOT10k (otoczenie pola: drzewa, budowle wodne i wały, obszary chronione) w PostGIS';
const LICENCE = 'dane publiczne GUGiK, bezpłatne (podać źródło: BDOT10k, GUGiK)';
const RESOLUTION = 'wektor 1:10 000 (uproszczenie 2–20 m)';
const TIMEOUT_MS = 4000;
const TABLES = ['bdot_cover', 'bdot_waterworks', 'bdot_protected'] as const;

const FIELD_CTE = `with field as (
  select ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 2180) as geom
)`;

/** Otwarte rowy, strumienie i kanaly (bdot_hydro), ktore moga wchodzic w rure. */
const OPEN_CHANNEL_KINDS = [1, 3, 4];

export function surroundingsQueries(field: FieldArea): SqlQuery[] {
  const geometry = JSON.stringify(field.geometry);
  const { treeBandM, treesM, waterworksM, junctionM } = SURROUNDINGS_RADII;

  return [
    {
      text: `${FIELD_CTE}
select c.kind, count(*)::int as features, min(ST_Distance(c.geom, field.geom))::float8 as nearest_m
from bdot_cover c, field
where ST_DWithin(c.geom, field.geom, $2)
group by c.kind`,
      params: [geometry, treesM],
    },
    {
      // bufory drzew zlaczone przed przecieciem z granica - inaczej odcinek przy dwoch rzedach liczy sie dwa razy
      text: `${FIELD_CTE}
select ST_Length(ST_Boundary(field.geom))::float8 as edge_m,
       coalesce((
         select ST_Length(ST_Intersection(ST_Boundary(field.geom), ST_Buffer(ST_Union(c.geom), $2)))
         from bdot_cover c
         where ST_DWithin(c.geom, field.geom, $2)
       ), 0)::float8 as wooded_edge_m
from field`,
      params: [geometry, treeBandM],
    },
    {
      text: `${FIELD_CTE}
select w.kind,
       count(*)::int as features,
       min(ST_Distance(w.geom, field.geom))::float8 as nearest_m,
       (array_agg(w.name order by ST_Distance(w.geom, field.geom)) filter (where w.name is not null))[1] as nearest_name
from bdot_waterworks w, field
where ST_DWithin(w.geom, field.geom, $2)
group by w.kind`,
      params: [geometry, waterworksM],
    },
    {
      // styk: otwarty row albo ciek (bdot_hydro) w 5 m od odcinka w rurze (bdot_waterworks) - zwykle przepust pod droga
      text: `${FIELD_CTE}
select ST_Distance(p.geom, field.geom)::float8 as distance_m,
       ST_AsGeoJSON(ST_Transform(ST_ClosestPoint(p.geom, d.geom), 4326), 6) as point
from bdot_waterworks p, field, bdot_hydro d
where p.kind = any($3::smallint[])
  and ST_DWithin(p.geom, field.geom, $2)
  and d.kind = any($4::smallint[])
  and ST_DWithin(d.geom, p.geom, 5)
order by 1
limit 1`,
      params: [geometry, junctionM, [...WATERWORKS_CODES.piped], OPEN_CHANNEL_KINDS],
    },
    {
      text: `${FIELD_CTE}
select distinct p.kind, p.name
from bdot_protected p, field
where ST_Intersects(p.geom, field.geom)`,
      params: [geometry],
    },
    {
      text: `select table_name, max(imported_at) as imported_at
from bdot_import
where table_name = any($1::text[])
group by table_name`,
      params: [[...TABLES]],
    },
  ];
}

const numberOf = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0));
const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

function summaryRows(rows: readonly Record<string, unknown>[]): KindSummaryRow[] {
  return rows.map((row) => ({
    kind: numberOf(row.kind),
    features: numberOf(row.features),
    nearestM: numberOf(row.nearest_m),
    nearestName: textOf(row.nearest_name),
  }));
}

function junctionOf(rows: readonly Record<string, unknown>[]): { distanceM: number; point: LngLat } | null {
  const row = rows[0];

  if (!row || typeof row.point !== 'string') return null;

  const point = (JSON.parse(row.point) as { coordinates?: unknown }).coordinates;

  if (!Array.isArray(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number') return null;

  return { distanceM: numberOf(row.distance_m), point: [point[0], point[1]] };
}

const isoOf = (value: unknown): string | null =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === 'string'
      ? new Date(value).toISOString()
      : null;

/** Data importu kazdej z trzech tabel; null, gdy ktorejs brakuje (tabela niezaimportowana). */
function importDates(rows: readonly Record<string, unknown>[]): Record<string, string> | null {
  const dates = Object.fromEntries(
    rows.flatMap((row) => {
      const date = isoOf(row.imported_at);

      return typeof row.table_name === 'string' && date ? [[row.table_name, date]] : [];
    }),
  );

  return TABLES.every((table) => table in dates) ? dates : null;
}

export interface PostgisSurroundingsOptions {
  /** null = brak DATABASE_URL (zrodlo oddaje `missing`) */
  run: SqlRunner | null;
  now?: () => string;
}

export function createPostgisSurroundingsSource({
  run,
  now = () => new Date().toISOString(),
}: PostgisSurroundingsOptions): SurroundingsSource {
  return {
    async surroundings(field): Promise<Sourced<Surroundings>> {
      // id `hydro`: ta sama rodzina danych (BDOT10k w PostGIS); osobny `provider` odroznia wpis w zrodlach raportu
      const base: SourceRef = {
        id: 'hydro',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        resolution: RESOLUTION,
      };

      if (!run) {
        return {
          data: null,
          source: { ...base, note: 'brak bazy otoczenia pola w konfiguracji (DATABASE_URL)' },
        };
      }

      const result = await run(surroundingsQueries(field), AbortSignal.timeout(TIMEOUT_MS)).catch(
        (error: unknown) => new Error(failureNote('baza otoczenia pola', error)),
      );

      if (result instanceof Error) return { data: null, source: { ...base, note: result.message } };

      const [cover = [], edge = [], waterworks = [], junction = [], protectedRows = [], imports = []] =
        result;
      const dates = importDates(imports);

      if (!dates) {
        return {
          data: null,
          source: { ...base, note: 'otoczenie pola z BDOT10k nie jest zaimportowane do bazy' },
        };
      }

      const imported = Object.values(dates).toSorted().at(-1) ?? now();

      return {
        data: surroundingsFromRows({
          cover: summaryRows(cover),
          edge: { edgeM: numberOf(edge[0]?.edge_m), woodedEdgeM: numberOf(edge[0]?.wooded_edge_m) },
          waterworks: summaryRows(waterworks),
          junction: junctionOf(junction),
          protectedAreas: protectedRows.map((row) => ({ kind: numberOf(row.kind), name: textOf(row.name) })),
        }),
        source: {
          ...base,
          status: 'ok',
          // data importu tabel otoczenia (najnowsza z trzech) - stan obecny, dla dawnych dat to przyblizenie
          fetchedAt: imported,
          note: `BDOT10k zaimportowany ${imported.slice(0, 10)} (drzewa, budowle i wały, obszary chronione; stan obecny); drzewa przy granicy w pasie ${SURROUNDINGS_RADII.treeBandM} m, budowle, wały i źródła w ${SURROUNDINGS_RADII.waterworksM / 1000} km; BDOT10k nie zna zastawek ani przepustów; odczyt ${now().slice(0, 10)}`,
        },
      };
    },
  };
}
