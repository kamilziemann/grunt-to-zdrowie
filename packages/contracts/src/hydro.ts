// Warstwa "woda w otoczeniu" na mapie: rowy, cieki, kanaly, wody i mokradla z BDOT10k (tabela `bdot_hydro`, zob.
// tools/bdot-import). Odczyt idzie kaflami o stalym przyblizeniu, zeby adresy byly powtarzalne i trafialy w cache
// brzegowy - tak samo jak granice dzialek (parcel.ts). Analiza pola uzywa osobnego, wewnetrznego portu serwera.
import { z } from 'zod';

import { parcelGeometrySchema } from './parcel';

/** Przyblizenie kafli hydrografii: kafel ma ok. 1,5 km boku na szerokosci Polski. */
export const HYDRO_TILE_ZOOM = 14;

/** Najwiecej obiektow w jednej odpowiedzi; nadmiar jest ucinany, a odpowiedz niesie `truncated`. */
export const HYDRO_TILE_FEATURES_MAX = 2000;

export const HYDRO_FEATURE_KINDS = [
  'ditch',
  'river',
  'stream',
  'canal',
  'standing_water',
  'flowing_water',
  'wetland',
  'bog',
] as const;

export const hydroFeatureKindSchema = z.enum(HYDRO_FEATURE_KINDS);

export type HydroFeatureKind = z.infer<typeof hydroFeatureKindSchema>;

const hydroTileIndexSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(2 ** HYDRO_TILE_ZOOM - 1);

export const hydroTileQuerySchema = z.object({ x: hydroTileIndexSchema, y: hydroTileIndexSchema });

export type HydroTileQuery = z.infer<typeof hydroTileQuerySchema>;

const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});

const multiLineStringSchema = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(2)),
});

/** Linie (rowy, cieki, kanaly) albo poligony (wody, mokradla), wspolrzedne [dlugosc, szerokosc] w WGS84. */
export const hydroGeometrySchema = z.union([lineStringSchema, multiLineStringSchema, parcelGeometrySchema]);

export const hydroFeatureSchema = z.object({
  kind: hydroFeatureKindSchema,
  /** nazwa wlasna, gdy obiekt ja ma (rzeki, kanaly, jeziora) */
  name: z.string().nullable(),
  geometry: hydroGeometrySchema,
});

export type HydroFeature = z.infer<typeof hydroFeatureSchema>;

export const hydroTileSchema = z.object({
  features: z.array(hydroFeatureSchema),
  /** true = obiektow bylo wiecej niz HYDRO_TILE_FEATURES_MAX i czesc pominieto */
  truncated: z.boolean(),
  /** kiedy zaimportowano dane BDOT10k (ISO 8601) - data danych do legendy mapy */
  importedAt: z.string().nullable(),
});

export type HydroTile = z.infer<typeof hydroTileSchema>;
