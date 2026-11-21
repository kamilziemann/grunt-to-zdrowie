// Zadanie analizy wodnej i "pole" - jednostka analizy. Pole to geometria z uprawa: jedna dzialka (sciezka jury),
// kilka dzialek razem, czesc dzialki albo obszar narysowany recznie. Silnik zna tylko pole, wiec rysowanie i
// dzielenie dzialek nie zmienia obliczen. Raport: report.ts.
import { z } from 'zod';

import { cropIdSchema } from './crop';
import { PARCEL_LIMITS, parcelGeometrySchema, parcelIdSchema } from './parcel';

/** Data kalendarzowa RRRR-MM-DD (bez strefy czasowej - dzien w Polsce). */
export const isoDateSchema = z.iso.date();

export type IsoDate = z.infer<typeof isoDateSchema>;

/** Jak daleko wstecz siega analiza i historia (wymog zadania: ostatnie 10 lat). */
export const ANALYSIS_LIMITS = { historyYears: 10, labelMax: 80 } as const;

export const FIELD_KINDS = ['parcel', 'parcels', 'part', 'drawn'] as const;

export const fieldAreaSchema = z.object({
  /** stabilny identyfikator pola (z dzialek albo ze skrotu geometrii) - skladnik klucza raportu */
  id: z.string(),
  kind: z.enum(FIELD_KINDS),
  parcelIds: z.array(z.string()),
  /** opis dla czlowieka, np. "Działka 6509, Mińsk Mazowiecki" */
  label: z.string(),
  geometry: parcelGeometrySchema,
  /** [dlugosc, szerokosc] srodka pola - punkt dla danych o siatce kilometrowej (pogoda) */
  centroid: z.tuple([z.number(), z.number()]),
  /** [zachod, poludnie, wschod, polnoc] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** powierzchnia policzona z geometrii */
  areaHa: z.number(),
  /** powierzchnia ewidencyjna (EGiB), gdy zrodlo ja podaje */
  registryAreaHa: z.number().optional(),
  /** klasouzytki EGiB, np. ["RIIIa", "RIVb"], gdy zrodlo je podaje */
  landUse: z.array(z.string()).optional(),
});

export type FieldArea = z.infer<typeof fieldAreaSchema>;

/**
 * Co analizowac: dzialki po identyfikatorach (geometrie pobiera serwer) albo wlasna geometria (fragment dzialki,
 * obszar narysowany). `kind` odroznia fragment istniejacej dzialki od obszaru narysowanego od zera.
 */
export const analysisFieldInputSchema = z.union([
  // Wariant z geometria musi byc pierwszy: unia bierze pierwszy pasujacy ksztalt, a obszar wyciety z dzialki niesie
  // tez `parcelIds` - przy odwrotnej kolejnosci serwer po cichu analizowalby cale dzialki zamiast wskazanej czesci.
  z.object({
    geometry: parcelGeometrySchema,
    kind: z.enum(['part', 'drawn']).default('drawn'),
    label: z.string().trim().min(1).max(ANALYSIS_LIMITS.labelMax).optional(),
    /** dzialki, z ktorych wycieto obszar (do opisu raportu) */
    parcelIds: z.array(parcelIdSchema).max(PARCEL_LIMITS.selectionMax).default([]),
  }),
  z.object({
    parcelIds: z.array(parcelIdSchema).min(1).max(PARCEL_LIMITS.selectionMax),
  }),
]);

export type AnalysisFieldInput = z.infer<typeof analysisFieldInputSchema>;

export const analysisRequestSchema = z.object({
  field: analysisFieldInputSchema,
  cropId: cropIdSchema,
  /** data analizy: dzis albo dzien z ostatnich 10 lat (granice sprawdza serwer wzgledem biezacej daty) */
  date: isoDateSchema,
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

/** Kategorie danych wymagane w zadaniu KOWR + prognoza (do wskazowki nawadniania). */
export const SOURCE_IDS = ['parcel', 'meteo', 'forecast', 'soil', 'terrain', 'hydro', 'vegetation'] as const;

export const sourceIdSchema = z.enum(SOURCE_IDS);

export type SourceId = z.infer<typeof sourceIdSchema>;

/**
 * Skad pochodza dane w raporcie i w jakim sa stanie. `missing` = zrodlo nie odpowiedzialo albo nie ma danych dla
 * tego miejsca/daty - raport mowi o tym wprost i obniza pewnosc, analiza sie nie przerywa.
 */
export const sourceRefSchema = z.object({
  id: sourceIdSchema,
  /** nazwa dostawcy i zbioru, np. "NASA POWER", "GUGiK ULDK" */
  provider: z.string(),
  status: z.enum(['ok', 'partial', 'missing']),
  /** dane wygenerowane przykladowo (atrapa), nie z prawdziwego zrodla - raport musi to pokazac */
  sample: z.boolean(),
  licence: z.string().optional(),
  url: z.string().optional(),
  /** kiedy pobrano dane (ISO 8601) */
  fetchedAt: z.string().optional(),
  /** zakres dat danych, ktore weszly do obliczen */
  dataFrom: isoDateSchema.optional(),
  dataTo: isoDateSchema.optional(),
  /** rozdzielczosc przestrzenna opisowo, np. "ok. 50 km", "10 m" */
  resolution: z.string().optional(),
  /** powod statusu partial/missing (dla dewelopera i sekcji "ograniczenia") */
  note: z.string().optional(),
});

export type SourceRef = z.infer<typeof sourceRefSchema>;
