// Ustawienia warstw mapy dzialek zapisane w pamieci przegladarki: schemat odczytu (zly albo stary zapis = wartosci
// domyslne pole po polu, nigdy blad) i domyslny zestaw - tylko to, co bylo wlaczone przed panelem warstw.
import { z } from 'zod';

export const mapLayersSchema = z.object({
  basemap: z.enum(['map', 'ortho']).catch('map'),
  boundaries: z.boolean().catch(true),
  hydro: z.boolean().catch(true),
  cover: z.boolean().catch(false),
  waterworks: z.boolean().catch(false),
  protected: z.boolean().catch(false),
  imagery: z.enum(['none', 'condition', 'moisture']).catch('none'),
  imageryMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .catch(null),
});

export type MapLayers = z.infer<typeof mapLayersSchema>;

/** Wartosci domyslne: kazde pole z `catch` schematu. */
export const MAP_LAYERS_DEFAULTS: MapLayers = mapLayersSchema.parse({});

/** Zapis z pamieci przegladarki (tekst JSON albo null) -> ustawienia; brak i smieci = domyslne. */
export function parseMapLayers(raw: string | null): MapLayers {
  if (raw === null) return MAP_LAYERS_DEFAULTS;

  try {
    const value: unknown = JSON.parse(raw);

    return mapLayersSchema.parse(typeof value === 'object' && value !== null ? value : {});
  } catch {
    return MAP_LAYERS_DEFAULTS;
  }
}
