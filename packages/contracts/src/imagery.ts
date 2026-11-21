// Obrazy pola z satelity (tryb "Woda na polu w 3D", eksperymentalny): kondycja roslin albo woda w roslinach z
// najczystszego zdjecia Sentinel-2 przed wybranym dniem, pokolorowane na skali wzglednej (porownanie miejsc w polu)
// i przyciete do dzialek. PNG jedzie jako data URL - strona kladzie go na mapie bez drugiego zapytania.
import { z } from 'zod';

import { isoDateSchema } from './analysis';

/**
 * Warstwa obrazu: `condition` = kondycja roslin (NDVI z pasm B04/B08), `moisture` = woda w roslinach (NDMI z pasm
 * B8A/B11, skala od suchego do wilgotnego).
 */
export const IMAGERY_LAYERS = ['condition', 'moisture'] as const;

export const imageryLayerSchema = z.enum(IMAGERY_LAYERS);

export type ImageryLayer = z.infer<typeof imageryLayerSchema>;

/** [zachod, poludnie, wschod, polnoc] w WGS84 */
export const imageryBboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const vegetationImageryQuerySchema = z.object({
  /** identyfikatory dzialek po przecinku (jak `?dzialki=` stron) */
  dzialki: z.string().min(1).max(2000),
  /** ostatni dzien okna szukania zdjecia; brak = dzis */
  data: isoDateSchema.optional(),
  /** brak = kondycja roslin */
  warstwa: imageryLayerSchema.optional(),
});

export type VegetationImageryQuery = z.infer<typeof vegetationImageryQuerySchema>;

export const vegetationImagerySchema = z.object({
  layer: imageryLayerSchema,
  /** PNG na dzialke jako data URL (wspolna skala kolorow pola, przezroczyste poza dzialka i pod chmura) */
  images: z.array(z.object({ image: z.string(), bbox: imageryBboxSchema })),
  bbox: imageryBboxSchema,
  requestedDate: isoDateSchema,
  sceneDate: isoDateSchema,
  /** zachmurzenie calej sceny w procentach */
  sceneCloudCover: z.number(),
  /** czesc pola widoczna bez chmur, 0-1 */
  clearShare: z.number(),
  /** wartosci wskaznika na poczatku i koncu skali kolorow (5. i 95. percentyl pola) i srednia pola */
  scale: z.object({ low: z.number(), high: z.number(), mean: z.number() }),
});

export type VegetationImagery = z.infer<typeof vegetationImagerySchema>;
