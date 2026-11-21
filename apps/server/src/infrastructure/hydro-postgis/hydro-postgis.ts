// Adapter HydroSource na hydrografie BDOT10k w Postgresie z PostGIS (Neon, ADR 0010; import: tools/bdot-import).
// Trzy zapytania tylko do odczytu w jednym wywolaniu HTTP: podsumowanie rodzajow obiektow w 500 m od poligonu pola
// (odleglosci w EPSG:2180, w metrach), najblizsze obiekty do mapy i data importu z `bdot_import`. Brak adresu bazy,
// limit czasu albo blad bazy = `missing`; pusta odpowiedz = "nic zmapowanego w 500 m" (wynik).
import type { FieldArea, SourceRef } from '@app/contracts';

import type { HydroContext, HydroSource, Sourced } from '../../domain/analysis-ports';
import { hydroContextFromRows, type HydroFeatureRow, type HydroKindRow } from '../../domain/hydro-context';

export const SEARCH_RADIUS_M = 500;

const PROVIDER = 'GUGiK BDOT10k (hydrografia: rowy, cieki, kanały, wody, mokradła) w PostGIS';
const LICENCE = 'dane publiczne GUGiK, bezpłatne (podać źródło: BDOT10k, GUGiK)';
const RESOLUTION = 'wektor 1:10 000 (uproszczenie 2 m)';
const TIMEOUT_MS = 4000;
/** najblizsze obiekty do mapy raportu - wiecej nie zmiesci sie czytelnie */
const MAP_FEATURES = 60;

export interface SqlQuery {
  text: string;
  params: unknown[];
}

/** Wykonuje zapytania w jednej transakcji tylko do odczytu i oddaje wiersze kazdego z nich. */
export type SqlRunner = (queries: SqlQuery[], signal: AbortSignal) => Promise<Record<string, unknown>[][]>;

export interface PostgisHydroOptions {
  /** null = brak DATABASE_URL (zrodlo oddaje `missing`) */
  run: SqlRunner | null;
  now?: () => string;
}

const FIELD_CTE = `with field as (
  select ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 2180) as geom
)`;

export function hydroQueries(field: FieldArea): SqlQuery[] {
  const geometry = JSON.stringify(field.geometry);

  return [
    {
      text: `${FIELD_CTE}
select h.kind,
       count(*)::int as features,
       min(ST_Distance(h.geom, field.geom))::float8 as nearest_m,
       (array_agg(h.name order by ST_Distance(h.geom, field.geom)) filter (where h.name is not null))[1] as nearest_name,
       coalesce(sum(ST_Length(ST_Intersection(h.geom, field.geom))) filter (where ST_Dimension(h.geom) = 1), 0)::float8 as length_in_field_m
from bdot_hydro h, field
where ST_DWithin(h.geom, field.geom, $2)
group by h.kind`,
      params: [geometry, SEARCH_RADIUS_M],
    },
    {
      text: `${FIELD_CTE}
select h.kind,
       ST_AsGeoJSON(ST_Transform(ST_Intersection(h.geom, ST_Buffer(field.geom, $2)), 4326), 6) as geometry
from bdot_hydro h, field
where ST_DWithin(h.geom, field.geom, $2)
order by ST_Distance(h.geom, field.geom)
limit $3`,
      params: [geometry, SEARCH_RADIUS_M, MAP_FEATURES],
    },
    { text: 'select max(imported_at) as imported_at from bdot_import', params: [] },
  ];
}

const numberOf = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0));

function kindRows(rows: Record<string, unknown>[]): HydroKindRow[] {
  return rows.map((row) => ({
    kind: numberOf(row.kind),
    features: numberOf(row.features),
    nearestM: numberOf(row.nearest_m),
    nearestName: typeof row.nearest_name === 'string' ? row.nearest_name : null,
    lengthInFieldM: numberOf(row.length_in_field_m),
  }));
}

function featureRows(rows: Record<string, unknown>[]): HydroFeatureRow[] {
  return rows.flatMap((row) => {
    if (typeof row.geometry !== 'string') return [];

    const geometry = JSON.parse(row.geometry) as HydroFeatureRow['geometry'];

    return [{ kind: numberOf(row.kind), geometry }];
  });
}

function importedAt(rows: Record<string, unknown>[]): string | null {
  const value = rows[0]?.imported_at;

  if (value instanceof Date) return value.toISOString();

  return typeof value === 'string' ? new Date(value).toISOString() : null;
}

export function createPostgisHydroSource({
  run,
  now = () => new Date().toISOString(),
}: PostgisHydroOptions): HydroSource {
  return {
    async context(field): Promise<Sourced<HydroContext>> {
      const base: SourceRef = {
        id: 'hydro',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        resolution: RESOLUTION,
      };

      if (!run) return { data: null, source: { ...base, note: 'DATABASE_URL is not configured' } };

      const result = await run(hydroQueries(field), AbortSignal.timeout(TIMEOUT_MS)).catch(
        (error: unknown) => (error instanceof Error ? error : new Error('hydrography query failed')),
      );

      if (result instanceof Error) {
        return { data: null, source: { ...base, note: `hydrography database: ${result.message}` } };
      }

      const [summary = [], features = [], imports = []] = result;
      const imported = importedAt(imports);

      if (imported === null) {
        return { data: null, source: { ...base, note: 'hydrography not imported (bdot_import is empty)' } };
      }

      return {
        data: hydroContextFromRows(kindRows(summary), featureRows(features), SEARCH_RADIUS_M),
        source: {
          ...base,
          status: 'ok',
          // data importu BDOT10k do bazy - warstwa jest biezaca, dla dawnych dat to wspolczesne przyblizenie
          fetchedAt: imported,
          note: `BDOT10k imported ${imported.slice(0, 10)}; distances from the field boundary, radius ${SEARCH_RADIUS_M} m; queried ${now().slice(0, 10)}`,
        },
      };
    },
  };
}
