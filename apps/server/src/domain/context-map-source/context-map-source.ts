// Port kafli otoczenia pola do mapy (warstwy drzew, sieci wodnej i obszarow chronionych) i przeliczenie wierszy bazy
// na kontrakt `ContextTile`. Implementacja: infrastructure/surroundings-postgis (tabele BDOT10k w PostGIS). Kody
// `kind` z tools/bdot-import/README.md - kazda warstwa zna tylko swoje.
import {
  CONTEXT_TILE_FEATURES_MAX,
  contextGeometrySchema,
  type ContextFeature,
  type ContextFeatureKind,
  type ContextLayer,
  type ContextTile,
} from '@app/contracts';

import type { BoundingBox } from '../parcel-geometry';

/** Kody `kind` tabel otoczenia -> rodzaj obiektu na mapie, osobno dla kazdej warstwy. */
export const CONTEXT_MAP_KINDS: Readonly<Record<ContextLayer, Readonly<Record<number, ContextFeatureKind>>>> =
  {
    cover: { 20: 'forest', 21: 'grove', 22: 'woodland', 23: 'tree_row', 24: 'hedge' },
    waterworks: {
      30: 'weir',
      31: 'dam',
      32: 'lock',
      33: 'intake',
      34: 'spring',
      40: 'levee',
      41: 'piped_ditch',
      42: 'piped_watercourse',
      43: 'piped_canal',
    },
    protected: { 50: 'natura2000', 51: 'landscape_park', 52: 'national_park', 53: 'nature_reserve' },
  };

/** Wiersz kafla: obiekt przyciety do kafla, geometria GeoJSON w WGS84 (jeszcze niesprawdzona). */
export interface ContextTileRow {
  kind: number;
  name: string | null;
  geometry: unknown;
}

export interface ContextTileRows {
  /** wiersze w kolejnosci waznosci; moze ich byc o jeden wiecej niz limit */
  rows: ContextTileRow[];
  importedAt: string | null;
}

export interface ContextMapSource {
  /** obiekty warstwy przecinajace prostokat [zachod, poludnie, wschod, polnoc]; najwyzej `limit` wierszy */
  tile(layer: ContextLayer, bounds: BoundingBox, limit: number): Promise<ContextTileRows>;
}

function toFeature(layer: ContextLayer, row: ContextTileRow): ContextFeature[] {
  const kind = CONTEXT_MAP_KINDS[layer][row.kind];
  const geometry = contextGeometrySchema.safeParse(row.geometry);

  // kod spoza warstwy albo geometria, ktorej mapa nie narysuje (pusta kolekcja po przycieciu) - pomijamy
  if (!kind || !geometry.success) return [];

  return [{ kind, name: row.name, geometry: geometry.data }];
}

/** Wiersze -> kafel; przy nadmiarze ucina do `max` i ustawia `truncated`. */
export function contextTileFromRows(
  layer: ContextLayer,
  { rows, importedAt }: ContextTileRows,
  max = CONTEXT_TILE_FEATURES_MAX,
): ContextTile {
  const features = rows.flatMap((row) => toFeature(layer, row));

  return { layer, features: features.slice(0, max), truncated: rows.length > max, importedAt };
}
