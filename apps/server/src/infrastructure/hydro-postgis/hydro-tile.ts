// Adapter HydroMapSource: obiekty BDOT10k przecinajace kafel mapy, przyciete do kafla i oddane w WGS84. Dwa zapytania
// tylko do odczytu w jednym wywolaniu HTTP (obiekty + data importu). Kolejnosc: najpierw cieki, kanaly i rowy (linie,
// najdluzsze najpierw), potem wody i mokradla (najwieksze najpierw) - przy ucieciu zostaje to, co najwazniejsze.
import type { BoundingBox } from '../../domain/parcel-geometry';
import type { HydroMapSource, HydroTileRows } from '../../domain/hydro-map-source';
import type { SqlQuery, SqlRunner } from './hydro-postgis';

const TIMEOUT_MS = 8000;

export function hydroTileQueries([west, south, east, north]: BoundingBox, limit: number): SqlQuery[] {
  return [
    {
      // przyciecie do kafla trzyma odpowiedz w ryzach (rzeka przez pol wojewodztwa); CollectionExtract zostawia
      // tylko linie albo poligony, a MakeValid chroni przed bledem calego kafla przez jeden zly obrys
      text: `with tile as (
  select ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 2180) as geom
),
hits as (
  select h.kind,
         h.name,
         ST_CollectionExtract(
           ST_Intersection(case when ST_IsValid(h.geom) then h.geom else ST_MakeValid(h.geom) end, tile.geom),
           case when ST_Dimension(h.geom) = 1 then 2 else 3 end
         ) as geom,
         case when h.kind in (1, 2, 3, 4) then 0 else 1 end as priority
  from bdot_hydro h, tile
  where ST_Intersects(h.geom, tile.geom)
)
select kind, name, ST_AsGeoJSON(ST_Transform(geom, 4326), 6) as geometry
from hits
where not ST_IsEmpty(geom)
order by priority, ST_Length(geom) desc, ST_Area(geom) desc
limit $5`,
      params: [west, south, east, north, limit],
    },
    { text: 'select max(imported_at) as imported_at from bdot_import', params: [] },
  ];
}

function importedAt(rows: Record<string, unknown>[] | undefined): string | null {
  const value = rows?.[0]?.imported_at;

  if (value instanceof Date) return value.toISOString();

  return typeof value === 'string' ? new Date(value).toISOString() : null;
}

/** Blad bazy przechodzi wyzej - serwis zamienia go na 502 (mapa pokazuje warstwe jako niedostepna). */
export function createPostgisHydroMapSource({ run }: { run: SqlRunner }): HydroMapSource {
  return {
    async tile(bounds, limit): Promise<HydroTileRows> {
      const [features = [], imports] = await run(
        hydroTileQueries(bounds, limit),
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
