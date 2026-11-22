// Otoczenie pola z BDOT10k (tabele `bdot_cover`, `bdot_waterworks`, `bdot_protected`, zob. tools/bdot-import):
// drzewa przy granicy, miejsca na sieci wodnej (jazy, waly, zrodla, odcinki rowow w rurach) i obszary chronione.
// Dwa uzycia: czesc raportu (`surroundings`, argumenty do zalecen) i warstwy mapy czytane kaflami na tej samej siatce
// co hydrografia (hydro.ts), osobna trasa, zeby kafle wody nie rosly.
import { z } from 'zod';

import { hydroGeometrySchema, HYDRO_TILE_ZOOM } from './hydro';

export const PROTECTED_AREA_KINDS = [
  'natura2000',
  'landscape_park',
  'national_park',
  'nature_reserve',
] as const;

export const protectedAreaKindSchema = z.enum(PROTECTED_AREA_KINDS);

export type ProtectedAreaKind = z.infer<typeof protectedAreaKindSchema>;

/** Budowle hydrotechniczne, ktore zna BDOT10k - zastawek i przepustow tam nie ma. */
export const WATER_STRUCTURE_KINDS = ['weir', 'dam', 'lock'] as const;

export const waterStructureKindSchema = z.enum(WATER_STRUCTURE_KINDS);

export type WaterStructureKind = z.infer<typeof waterStructureKindSchema>;

/**
 * Drzewa przy polu. Granica "z drzewami" = odcinki granicy pola w pasie `bandM` od lasu, zadrzewienia, rzedu drzew
 * albo zywoplotu. Las = las, zagajnik, zadrzewienie (poligony); rzad = rzad drzew, pas krzewow, zywoplot (linie).
 */
export const fieldTreesSchema = z.object({
  bandM: z.number().positive(),
  /** dlugosc granicy pola i tej jej czesci, przy ktorej rosna drzewa (m) */
  edgeM: z.number().min(0),
  woodedEdgeM: z.number().min(0),
  /** udzial granicy z drzewami, 0-1 */
  woodedEdgeShare: z.number().min(0).max(1),
  /** jaka czesc powierzchni pola lezy pod lasem albo zadrzewieniem z BDOT10k, 0-1 (od silnika 0.8.5) */
  woodedAreaShare: z.number().min(0).max(1).optional(),
  /** najblizszy las i najblizszy rzad drzew albo zywoplot (m od granicy); null = brak w `searchRadiusM` */
  nearestForestM: z.number().min(0).nullable(),
  nearestTreeRowM: z.number().min(0).nullable(),
  searchRadiusM: z.number().positive(),
  /** granica w wiekszosci bez drzew (ponizej 25%) - wiatr wysusza pole bez przeszkod */
  openToWind: z.boolean(),
});

export type FieldTrees = z.infer<typeof fieldTreesSchema>;

export const fieldWaterworksSchema = z.object({
  /** promien szukania budowli, walow, zrodel i ujec (m) */
  searchRadiusM: z.number().positive(),
  /** najblizszy jaz, zapora albo sluza; null = brak w promieniu */
  nearestStructure: z
    .object({ kind: waterStructureKindSchema, distanceM: z.number().min(0), name: z.string().nullable() })
    .nullable(),
  /** liczba budowli (jazow, zapor, sluz) w promieniu */
  structures: z.number().int().min(0),
  /** waly przeciwpowodziowe i groble: liczba odcinkow w promieniu i odleglosc najblizszego */
  levees: z.number().int().min(0),
  nearestLeveeM: z.number().min(0).nullable(),
  /** najblizsze zrodlo (z nazwa, gdy ja ma) i ujecie wody */
  nearestSpring: z.object({ distanceM: z.number().min(0), name: z.string().nullable() }).nullable(),
  nearestIntakeM: z.number().min(0).nullable(),
  /** odcinki rowow, ciekow i kanalow w rurach w promieniu */
  pipedSegments: z.number().int().min(0),
  /**
   * miejsce, w ktorym otwarty row albo ciek wchodzi w rure (zwykle pod droga), najblizej pola w `junctionRadiusM` -
   * naturalny punkt pietrzenia; null = brak
   */
  pipedJunction: z
    .object({ distanceM: z.number().min(0), point: z.tuple([z.number(), z.number()]) })
    .nullable(),
  junctionRadiusM: z.number().positive(),
});

export type FieldWaterworks = z.infer<typeof fieldWaterworksSchema>;

export const protectedAreaSchema = z.object({ kind: protectedAreaKindSchema, name: z.string() });

export type ProtectedArea = z.infer<typeof protectedAreaSchema>;

/** Otoczenie pola w raporcie; `null` w czesci = baza nie odpowiedziala (wtedy zrodlo ma status `missing`). */
export const surroundingsSchema = z.object({
  trees: fieldTreesSchema,
  water: fieldWaterworksSchema,
  /** obszary chronione, w ktorych lezy pole albo jego czesc; pusta lista = poza obszarami */
  protectedAreas: z.array(protectedAreaSchema),
  /**
   * teren odwadniany mechanicznie (polder): pole przy poziomie morza albo nizej, gesta siec rowow, waly w poblizu -
   * obnizenie to czesc polderu, nie miejsce na oczko
   */
  drainedLowland: z.boolean().optional(),
});

export type Surroundings = z.infer<typeof surroundingsSchema>;

/** Warstwy mapy otoczenia pola. */
export const CONTEXT_LAYERS = ['cover', 'waterworks', 'protected'] as const;

export const contextLayerSchema = z.enum(CONTEXT_LAYERS);

export type ContextLayer = z.infer<typeof contextLayerSchema>;

/** Najwiecej obiektow w kaflu otoczenia; nadmiar jest ucinany, a odpowiedz niesie `truncated`. */
export const CONTEXT_TILE_FEATURES_MAX = 2000;

/** Kafle otoczenia leza na tej samej siatce co kafle hydrografii (z = 14). */
export const CONTEXT_TILE_ZOOM = HYDRO_TILE_ZOOM;

export const CONTEXT_FEATURE_KINDS = [
  // cover
  'forest',
  'grove',
  'woodland',
  'tree_row',
  'hedge',
  // waterworks
  'weir',
  'dam',
  'lock',
  'intake',
  'spring',
  'levee',
  'piped_ditch',
  'piped_watercourse',
  'piped_canal',
  // protected
  'natura2000',
  'landscape_park',
  'national_park',
  'nature_reserve',
] as const;

export const contextFeatureKindSchema = z.enum(CONTEXT_FEATURE_KINDS);

export type ContextFeatureKind = z.infer<typeof contextFeatureKindSchema>;

const contextTileIndexSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(2 ** CONTEXT_TILE_ZOOM - 1);

export const contextTileQuerySchema = z.object({
  layer: contextLayerSchema,
  x: contextTileIndexSchema,
  y: contextTileIndexSchema,
});

export type ContextTileQuery = z.infer<typeof contextTileQuerySchema>;

const pointSchema = z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) });

/** Linie, poligony albo punkty (ujecia, zrodla), wspolrzedne [dlugosc, szerokosc] w WGS84. */
export const contextGeometrySchema = z.union([pointSchema, hydroGeometrySchema]);

export const contextFeatureSchema = z.object({
  kind: contextFeatureKindSchema,
  /** nazwa wlasna (obszary chronione, czesc zrodel) */
  name: z.string().nullable(),
  geometry: contextGeometrySchema,
});

export type ContextFeature = z.infer<typeof contextFeatureSchema>;

export const contextTileSchema = z.object({
  layer: contextLayerSchema,
  features: z.array(contextFeatureSchema),
  /** true = obiektow bylo wiecej niz CONTEXT_TILE_FEATURES_MAX i czesc pominieto */
  truncated: z.boolean(),
  /** kiedy zaimportowano dane tej warstwy (ISO 8601) - data danych do legendy mapy */
  importedAt: z.string().nullable(),
});

export type ContextTile = z.infer<typeof contextTileSchema>;
