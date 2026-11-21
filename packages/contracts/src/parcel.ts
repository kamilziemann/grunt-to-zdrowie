// Dzialka ewidencyjna (EGiB): identyfikator, opis polozenia i geometria GeoJSON w WGS84. Zrodlo danych: ULDK GUGiK.
// Te same schematy waliduja API (/parcels/*) i parametry adresu stron (lista wybranych dzialek).
import { z } from 'zod';

export const PARCEL_LIMITS = {
  queryMin: 3,
  queryMax: 80,
  /** ile kandydatow oddaje wyszukiwanie po "obreb numer" (ULDK potrafi zwrocic kilkadziesiat) */
  candidatesMax: 100,
  /** ile dzialek miesci lista "moje dzialki" w adresie strony */
  selectionMax: 20,
} as const;

/** Granice Polski z zapasem - klikniecie poza nimi nie ma sensu odpytywac ULDK. */
export const POLAND_BOUNDS = { west: 14.0, south: 48.9, east: 24.3, north: 55.0 } as const;

/** Pelny identyfikator dzialki: TERYT gminy_typ.obreb.[arkusz.]numer, np. 141201_1.0001.6509 albo 020101_1.0001.AR_2.12/3. */
export const PARCEL_ID_PATTERN = /^\d{6}_\d\.\d{4}\.[0-9A-Za-z._/-]{1,40}$/;

export const parcelIdSchema = z.string().trim().regex(PARCEL_ID_PATTERN);

const positionSchema = z.tuple([z.number(), z.number()]);
const ringSchema = z.array(positionSchema);

export const parcelGeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ringSchema) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ringSchema)) }),
]);

export type ParcelGeometry = z.infer<typeof parcelGeometrySchema>;

/** Opis dzialki bez geometrii - pozycja listy kandydatow. */
export const parcelCandidateSchema = z.object({
  id: z.string(),
  /** numer dzialki w obrebie, np. "12/3" */
  number: z.string(),
  /** obreb ewidencyjny */
  region: z.string(),
  commune: z.string(),
  county: z.string(),
  voivodeship: z.string(),
});

export type ParcelCandidate = z.infer<typeof parcelCandidateSchema>;

export const parcelSchema = parcelCandidateSchema.extend({
  geometry: parcelGeometrySchema,
  /** [zachod, poludnie, wschod, polnoc] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** [dlugosc, szerokosc] */
  centroid: positionSchema,
  /** powierzchnia policzona z geometrii (nie powierzchnia ewidencyjna z EGiB) */
  areaHa: z.number(),
  /** skad pochodzi geometria: ULDK (podstawowe) albo zbiorcza usluga WFS ewidencji gruntow (zapasowe) */
  source: z.enum(['uldk', 'egib-wfs']),
  fetchedAt: z.string(),
  /** powierzchnia ewidencyjna z EGiB (ha), gdy zrodlo ja podaje (WFS ewidencji; ULDK nie) */
  registryAreaHa: z.number().optional(),
  /** klasouzytki EGiB, np. ["RIVb", "ŁV"] albo ["dr"], gdy zrodlo je podaje (WFS ewidencji; ULDK nie) */
  landUse: z.array(z.string()).optional(),
});

export type Parcel = z.infer<typeof parcelSchema>;

export const parcelSearchQuerySchema = z.object({
  q: z.string().trim().min(PARCEL_LIMITS.queryMin).max(PARCEL_LIMITS.queryMax),
});

export const parcelSearchResultSchema = z.object({
  /** ile dzialek pasuje wg ULDK; `items` moze byc krotsze (candidatesMax) */
  total: z.number().int(),
  items: z.array(parcelCandidateSchema),
});

export type ParcelSearchResult = z.infer<typeof parcelSearchResultSchema>;

export const parcelByIdQuerySchema = z.object({ id: parcelIdSchema });

export const parcelAtQuerySchema = z.object({
  lng: z.coerce.number().min(POLAND_BOUNDS.west).max(POLAND_BOUNDS.east),
  lat: z.coerce.number().min(POLAND_BOUNDS.south).max(POLAND_BOUNDS.north),
});

/**
 * Siatka, w ktorej mapa pobiera granice dzialek: kafle XYZ na tym poziomie (ok. 380 m boku w Polsce). Domyslny
 * poziom kafla trasy granic - stare adresy bez `z` dzialaja bez zmian.
 */
export const PARCEL_BOUNDARY_TILE_ZOOM = 16;
/**
 * Grubsza siatka (ok. 1,5 km boku): mapa pokazuje granice od tego przyblizenia, a ponizej 16 pobiera kafle tego
 * poziomu (4-9 zapytan na widok zamiast kilkudziesieciu).
 */
export const PARCEL_BOUNDARY_COARSE_ZOOM = 14;
/** Poziomy kafli, o ktore mozna pytac trase granic. */
export const PARCEL_BOUNDARY_TILE_ZOOMS = [PARCEL_BOUNDARY_COARSE_ZOOM, PARCEL_BOUNDARY_TILE_ZOOM] as const;

export type ParcelBoundaryTileZoom = (typeof PARCEL_BOUNDARY_TILE_ZOOMS)[number];

const tileIndexSchema = z.coerce.number().int().min(0);

export const parcelBoundaryTileQuerySchema = z
  .object({
    x: tileIndexSchema,
    y: tileIndexSchema,
    /** poziom kafla (14 albo 16); brak = 16 */
    z: z.coerce
      .number()
      .pipe(z.union([z.literal(PARCEL_BOUNDARY_COARSE_ZOOM), z.literal(PARCEL_BOUNDARY_TILE_ZOOM)]))
      .default(PARCEL_BOUNDARY_TILE_ZOOM),
  })
  .refine((tile) => tile.x < 2 ** tile.z && tile.y < 2 ** tile.z, {
    message: 'tile index out of range for zoom',
    path: ['x'],
  });

/** Obrys dzialki do warstwy "granice dzialek": numer, geometria i punkt na podpis. */
export const parcelOutlineSchema = z.object({
  id: z.string(),
  number: z.string(),
  geometry: parcelGeometrySchema,
  /** [dlugosc, szerokosc] - miejsce na numer dzialki */
  center: positionSchema,
});

export type ParcelOutline = z.infer<typeof parcelOutlineSchema>;

export const parcelBoundariesSchema = z.object({
  items: z.array(parcelOutlineSchema),
  /** zrodlo oddalo limit obiektow - w tym kaflu moze brakowac dzialek */
  truncated: z.boolean(),
});

export type ParcelBoundaries = z.infer<typeof parcelBoundariesSchema>;

/** Parametry adresu ekranow dzialek: `dzialki` to identyfikatory po przecinku (lista "moje dzialki"). */
export const parcelSelectionSearchSchema = z.object({
  dzialki: z.string().max(2000).optional().catch(undefined),
});

export type ParcelSelectionSearch = z.infer<typeof parcelSelectionSearchSchema>;

/** Lista identyfikatorow z parametru adresu: tylko poprawne, bez duplikatow, do limitu. */
export function parseParcelSelection(value: string | undefined): string[] {
  if (!value) return [];

  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => PARCEL_ID_PATTERN.test(id));

  return [...new Set(ids)].slice(0, PARCEL_LIMITS.selectionMax);
}

export function serializeParcelSelection(ids: readonly string[]): string | undefined {
  return ids.length === 0 ? undefined : ids.join(',');
}
