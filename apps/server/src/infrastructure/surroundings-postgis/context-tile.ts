// Adapter ContextMapSource: obiekty jednej tabeli otoczenia (bdot_cover, bdot_waterworks, bdot_protected) przecinajace
// kafel mapy, przyciete do kafla i oddane w WGS84. Dwa zapytania tylko do odczytu w jednym wywolaniu HTTP (obiekty
// + data importu tej tabeli). Kolejnosc przy ucieciu: drzewa - najwieksze lasy i najdluzsze rzedy; siec wodna - budowle,
// zrodla i ujecia przed walami i rurami; obszary chronione - po jednym obiekcie na obszar (kawalki zlaczone w kaflu).
import type { ContextLayer } from '@app/contracts';

import type { ContextMapSource, ContextTileRows } from '../../domain/context-map-source';
import type { BoundingBox } from '../../domain/parcel-geometry';
import type { SqlQuery, SqlRunner } from '../hydro-postgis';

const TIMEOUT_MS = 8000;

/** Tabela warstwy - stala z kodu, nigdy z zapytania uzytkownika (warstwa przechodzi walidacje enumem). */
export const CONTEXT_TABLES: Readonly<Record<ContextLayer, string>> = {
  cover: 'bdot_cover',
  waterworks: 'bdot_waterworks',
  protected: 'bdot_protected',
};

/** rodzaje sieci wodnej wazniejsze przy ucieciu: jaz, zapora, sluza, ujecie, zrodlo */
const WATERWORKS_FIRST = [30, 31, 32, 33, 34];

const TILE_CTE = `with tile as (
  select ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 2180) as geom
)`;

// przyciecie do kafla; CollectionExtract zostawia typ geometrii zrodla (punkt, linia, poligon), a MakeValid chroni
// przed bledem calego kafla przez jeden zly obrys
const CLIPPED = `ST_CollectionExtract(
  ST_Intersection(case when ST_IsValid(c.geom) then c.geom else ST_MakeValid(c.geom) end, tile.geom),
  ST_Dimension(c.geom) + 1
)`;

function featuresQuery(layer: ContextLayer, bounds: BoundingBox, limit: number): SqlQuery {
  const table = CONTEXT_TABLES[layer];

  if (layer === 'protected') {
    return {
      text: `${TILE_CTE},
hits as (
  select c.kind, c.name, ST_Union(${CLIPPED}) as geom
  from ${table} c, tile
  where ST_Intersects(c.geom, tile.geom)
  group by c.kind, c.name
)
select kind, name, ST_AsGeoJSON(ST_Transform(geom, 4326), 6) as geometry
from hits
where not ST_IsEmpty(geom)
order by ST_Area(geom) desc
limit $5`,
      params: [...bounds, limit],
    };
  }

  return {
    text: `${TILE_CTE},
hits as (
  select c.kind, c.name, ${CLIPPED} as geom,
         case when c.kind = any($6::smallint[]) then 0 else 1 end as priority
  from ${table} c, tile
  where ST_Intersects(c.geom, tile.geom)
)
select kind, name, ST_AsGeoJSON(ST_Transform(geom, 4326), 6) as geometry
from hits
where not ST_IsEmpty(geom)
order by priority, ST_Area(geom) desc, ST_Length(geom) desc
limit $5`,
    params: [...bounds, limit, layer === 'waterworks' ? WATERWORKS_FIRST : []],
  };
}

export function contextTileQueries(layer: ContextLayer, bounds: BoundingBox, limit: number): SqlQuery[] {
  return [
    featuresQuery(layer, bounds, limit),
    {
      text: 'select max(imported_at) as imported_at from bdot_import where table_name = $1',
      params: [CONTEXT_TABLES[layer]],
    },
  ];
}

function importedAt(rows: Record<string, unknown>[] | undefined): string | null {
  const value = rows?.[0]?.imported_at;

  if (value instanceof Date) return value.toISOString();

  return typeof value === 'string' ? new Date(value).toISOString() : null;
}

/** Blad bazy przechodzi wyzej - serwis zamienia go na 502 (mapa pokazuje warstwe jako niedostepna). */
export function createPostgisContextMapSource({ run }: { run: SqlRunner }): ContextMapSource {
  return {
    async tile(layer, bounds, limit): Promise<ContextTileRows> {
      const [features = [], imports] = await run(
        contextTileQueries(layer, bounds, limit),
        AbortSignal.timeout(TIMEOUT_MS),
      );

      return {
        rows: features.map((row) => ({
          kind: Number(row.kind),
          name: typeof row.name === 'string' && row.name.length > 0 ? row.name : null,
          geometry: typeof row.geometry === 'string' ? (JSON.parse(row.geometry) as unknown) : null,
        })),
        importedAt: importedAt(imports),
      };
    },
  };
}
