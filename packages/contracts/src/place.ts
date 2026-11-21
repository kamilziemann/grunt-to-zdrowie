// Miejsce znalezione po adresie albo nazwie (geokodowanie): punkt, do ktorego mapa dojezdza, zeby rolnik kliknal
// swoja dzialke. To nie jest dzialka - adres wskazuje okolice, wybor dzialki nalezy do uzytkownika.
import { z } from 'zod';

export const PLACE_LIMITS = { queryMin: 3, queryMax: 120, resultsMax: 6 } as const;

export const placeSearchQuerySchema = z.object({
  q: z.string().trim().min(PLACE_LIMITS.queryMin).max(PLACE_LIMITS.queryMax),
});

export const placeSchema = z.object({
  id: z.string(),
  /** pierwsza linia: ulica z numerem albo nazwa miejscowosci */
  label: z.string(),
  /** druga linia: gmina/miasto, powiat, wojewodztwo */
  detail: z.string(),
  /** [dlugosc, szerokosc] */
  center: z.tuple([z.number(), z.number()]),
  /** [zachod, poludnie, wschod, polnoc] - zasieg miejsca (miejscowosc, ulica); punkt adresowy ma maly */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export type Place = z.infer<typeof placeSchema>;

export const placeSearchResultSchema = z.object({ items: z.array(placeSchema) });

export type PlaceSearchResult = z.infer<typeof placeSearchResultSchema>;
