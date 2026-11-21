// Port kafli hydrografii do mapy (warstwa "woda w otoczeniu") i przeliczenie wierszy bazy na kontrakt `HydroTile`.
// Implementacja: infrastructure/hydro-postgis (BDOT10k w PostGIS). Kody `kind` z tools/bdot-import/README.md.
import {
  HYDRO_TILE_FEATURES_MAX,
  hydroGeometrySchema,
  type HydroFeature,
  type HydroFeatureKind,
  type HydroTile,
} from '@app/contracts';

import type { BoundingBox } from '../parcel-geometry';

/** Kody `kind` tabeli bdot_hydro -> rodzaj obiektu na mapie (1:1 z tabela w README importu). */
export const BDOT_MAP_KINDS: Readonly<Record<number, HydroFeatureKind>> = {
  1: 'ditch',
  2: 'river',
  3: 'stream',
  4: 'canal',
  5: 'standing_water',
  6: 'flowing_water',
  7: 'wetland',
  8: 'bog',
};

/** Wiersz kafla: obiekt przyciety do kafla, geometria GeoJSON w WGS84 (jeszcze niesprawdzona). */
export interface HydroTileRow {
  kind: number;
  name: string | null;
  geometry: unknown;
}

export interface HydroTileRows {
  /** wiersze w kolejnosci waznosci (cieki i rowy najpierw); moze ich byc o jeden wiecej niz limit */
  rows: HydroTileRow[];
  importedAt: string | null;
}

export interface HydroMapSource {
  /** obiekty przecinajace prostokat [zachod, poludnie, wschod, polnoc]; najwyzej `limit` wierszy */
  tile(bounds: BoundingBox, limit: number): Promise<HydroTileRows>;
}

function toFeature(row: HydroTileRow): HydroFeature[] {
  const kind = BDOT_MAP_KINDS[row.kind];
  const geometry = hydroGeometrySchema.safeParse(row.geometry);

  // nieznany kod albo geometria, ktorej mapa nie narysuje (punkt, pusta kolekcja po przycieciu) - pomijamy
  if (!kind || !geometry.success) return [];

  return [{ kind, name: row.name, geometry: geometry.data }];
}

/** Wiersze -> kafel; przy nadmiarze ucina do `max` i ustawia `truncated`. */
export function hydroTileFromRows(
  { rows, importedAt }: HydroTileRows,
  max = HYDRO_TILE_FEATURES_MAX,
): HydroTile {
  const features = rows.flatMap(toFeature);

  return {
    features: features.slice(0, max),
    truncated: rows.length > max,
    importedAt,
  };
}
