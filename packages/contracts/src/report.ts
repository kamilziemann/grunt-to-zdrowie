// Raport wodny dla pola: ocena -> historia -> przyczyny -> zalecenia (retencja, agrotechnika, nawadnianie) ->
// strefy na polu -> zrodla i ograniczenia. Raport niesie identyfikatory i liczby; zdania dla rolnika powstaja w
// apps/web z tlumaczen, dzieki czemu raport jest testowalny i dwujezyczny.
import { z } from 'zod';

import { fieldAreaSchema, isoDateSchema, sourceIdSchema, sourceRefSchema } from './analysis';
import { cropIdSchema, cropStageSchema, iungCropGroupSchema } from './crop';
import { parcelGeometrySchema } from './parcel';

/**
 * Poziom sytuacji wodnej. `out_of_season` = data poza okresem 21 marca - 30 wrzesnia, w ktorym obowiazuja progi
 * suszy rolniczej; `unknown` = za malo danych na ocene.
 */
export const ASSESSMENT_LEVELS = [
  'ok',
  'watch',
  'risk',
  'drought',
  'excess',
  'out_of_season',
  'unknown',
] as const;

export const assessmentLevelSchema = z.enum(ASSESSMENT_LEVELS);

export type AssessmentLevel = z.infer<typeof assessmentLevelSchema>;

export const confidenceSchema = z.enum(['high', 'medium', 'low']);

export type Confidence = z.infer<typeof confidenceSchema>;

export const soilCategorySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/** Kategoria podatnosci gleby na susze wg IUNG: 1 = bardzo podatna (lekka) ... 4 = malo podatna (ciezka). */
export type SoilCategory = z.infer<typeof soilCategorySchema>;

export const cropAtDateSchema = z.object({
  cropId: cropIdSchema,
  /** grupa z tabeli progow IUNG; null = uprawa bez progow (uzytki zielone) */
  iungGroup: iungCropGroupSchema.nullable(),
  stage: cropStageSchema,
  /** wspolczynnik uprawy Kc w dacie analizy; null poza okresem wegetacji */
  kc: z.number().nullable(),
  rootDepthM: z.number().nullable(),
});

export type CropAtDate = z.infer<typeof cropAtDateSchema>;

/**
 * Klimatyczny bilans wodny (opad minus ewapotranspiracja potencjalna) dla okresu szesciodekadowego konczacego sie
 * w dacie analizy, porownany z wartoscia progowa IUNG dla uprawy i kategorii gleby. Nie mnozymy przez Kc.
 */
export const climaticBalanceSchema = z.object({
  status: z.enum(['ok', 'out_of_season', 'not_monitored', 'missing']),
  /** numer okresu IUNG 1-14; null poza sezonem */
  periodNo: z.number().int().min(1).max(14).nullable(),
  periodFrom: isoDateSchema,
  periodTo: isoDateSchema,
  precipMm: z.number().nullable(),
  evapotranspirationMm: z.number().nullable(),
  balanceMm: z.number().nullable(),
  /** prog suszy; null gdy uprawa nie jest oceniana w tym okresie albo nie ma kategorii gleby */
  thresholdMm: z.number().nullable(),
  soilCategory: soilCategorySchema.nullable(),
  belowThreshold: z.boolean().nullable(),
  /** jak policzono ewapotranspiracje - nasz wynik jest oszacowaniem miary IUNG */
  method: z.enum(['fao56_penman_monteith', 'hargreaves', 'iung_dg95']),
  /** udzial dni okresu z danymi pogodowymi, 0-1 */
  coverage: z.number().min(0).max(1).optional(),
  /**
   * Wynik dla kazdej kategorii gleby I-IV - gdy kategoria jest niepewna, widac, czy jej wybor zmienia diagnoze.
   * `thresholdMm: null` = uprawa nie jest oceniana w tym okresie albo nie rosnie na tej glebie.
   */
  categoryScenarios: z
    .array(
      z.object({
        soilCategory: soilCategorySchema,
        thresholdMm: z.number().nullable(),
        belowThreshold: z.boolean().nullable(),
      }),
    )
    .optional(),
  /** miejsce KBW tego okresu wsrod tych samych okresow z lat poprzednich: 1 = najsuchszy */
  rankInHistory: z
    .object({ rank: z.number().int().positive(), years: z.number().int().positive() })
    .optional(),
});

export type ClimaticBalance = z.infer<typeof climaticBalanceSchema>;

/** Dobowy bilans strefy korzeniowej wg FAO-56 w dacie analizy. */
export const rootZoneSchema = z.object({
  /** woda dostepna dla roslin w strefie korzeni (TAW) i jej czesc latwo dostepna (RAW) */
  totalAvailableMm: z.number(),
  readilyAvailableMm: z.number(),
  /** wyczerpanie zapasu (Dr): 0 = pelny zapas */
  depletionMm: z.number(),
  /** udzial wyczerpania w TAW, 0-1 */
  depletionShare: z.number().min(0).max(1),
  /** wspolczynnik stresu wodnego Ks: 1 = brak stresu, 0 = punkt wiedniecia */
  stressCoefficient: z.number().min(0).max(1),
  /** dni ze stresem (Ks < 1) w ostatnich 30 dniach */
  stressDays30: z.number().int().min(0),
  /** dni ze stresem i niedobor ewapotranspiracji uprawy (suma ETc - ETc adj) od poczatku sezonu do daty analizy */
  seasonStressDays: z.number().int().min(0).optional(),
  seasonEtDeficitMm: z.number().min(0).optional(),
});

export type RootZone = z.infer<typeof rootZoneSchema>;

/** Sygnal z satelity (Sentinel-2) - niezalezne potwierdzenie reakcji roslin, nigdy samodzielna diagnoza. */
export const vegetationSignalSchema = z.object({
  observedOn: isoDateSchema,
  ndvi: z.number().nullable(),
  ndmi: z.number().nullable(),
  /** udzial czystych (bez chmur) pikseli pola, 0-1 */
  validShare: z.number().min(0).max(1),
  pixels: z.number().int().min(0),
  /** z ilu lat pochodzi porownanie tej samej pory roku */
  baselineYears: z.number().int().min(0),
  ndviAnomaly: z.number().nullable(),
  ndmiAnomaly: z.number().nullable(),
  interpretation: z.enum(['confirms_deficit', 'no_signal', 'not_comparable', 'possible_other_stress']),
});

export type VegetationSignal = z.infer<typeof vegetationSignalSchema>;

/** Opad z ostatnich dni na tle tego samego okresu w poprzednich latach ("3. najsuchszy z 10"). */
export const precipitationContextSchema = z.object({
  days: z.number().int().positive(),
  sumMm: z.number(),
  medianMm: z.number(),
  /** miejsce od najsuchszego: 1 = najsuchszy */
  rank: z.number().int().positive(),
  years: z.number().int().positive(),
});

export const assessmentSchema = z.object({
  level: assessmentLevelSchema,
  confidence: confidenceSchema,
  climaticBalance: climaticBalanceSchema.nullable(),
  rootZone: rootZoneSchema.nullable(),
  vegetation: vegetationSignalSchema.nullable(),
  precipitation: precipitationContextSchema.nullable(),
});

export type Assessment = z.infer<typeof assessmentSchema>;

export const periodStatusSchema = z.enum(['drought', 'ok', 'not_monitored', 'missing']);

export const historySchema = z.object({
  /** ile sezonow mialo dane - "prog przekroczony w 4 z 9 sezonow z danymi" */
  seasonsWithData: z.number().int().min(0),
  droughtSeasons: z.number().int().min(0),
  seasons: z.array(
    z.object({
      year: z.number().int(),
      /** okresy szesciodekadowe z susza i wszystkie oceniane w tym sezonie */
      droughtPeriods: z.number().int().min(0),
      monitoredPeriods: z.number().int().min(0),
      minBalanceMm: z.number().nullable(),
      /** dni ze stresem wodnym w sezonie wg bilansu strefy korzeniowej */
      stressDays: z.number().int().min(0).nullable(),
      /** niedobor ewapotranspiracji uprawy w sezonie (mm) - ile wody zabraklo uprawie wg bilansu */
      etDeficitMm: z.number().min(0).nullable().optional(),
    }),
  ),
  /** kalendarz ryzyka: rok x okres */
  calendar: z.array(
    z.object({
      year: z.number().int(),
      periodNo: z.number().int().min(1).max(14),
      status: periodStatusSchema,
      balanceMm: z.number().nullable(),
    }),
  ),
  /** miesiace (1-12), w ktorych niedobor powtarzal sie najczesciej */
  riskMonths: z.array(z.number().int().min(1).max(12)),
});

export type History = z.infer<typeof historySchema>;

/** Czesci raportu, ktore moga byc liczone przykladowo (zanim powstanie wlasciwy etap silnika). */
export const REPORT_PARTS = ['assessment', 'history', 'causes', 'zones', 'recommendations'] as const;

export const reportPartSchema = z.enum(REPORT_PARTS);

export type ReportPart = z.infer<typeof reportPartSchema>;

/** Liczba, na ktorej opiera sie wniosek: co zmierzono, ile, z jakiego zrodla i wzgledem czego. */
export const evidenceSchema = z.object({
  /** identyfikator miary (tlumaczony w apps/web), np. "precip_60d", "slope_mean" */
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  /** wartosc odniesienia: prog, mediana, norma */
  reference: z.number().optional(),
  source: sourceIdSchema,
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const CAUSE_IDS = [
  'precipitation_deficit',
  'high_evaporative_demand',
  'low_soil_retention',
  'surface_runoff',
  'fast_drainage',
  'no_landscape_retention',
  'crop_sensitivity',
] as const;

export const causeIdSchema = z.enum(CAUSE_IDS);

export type CauseId = z.infer<typeof causeIdSchema>;

export const causeSchema = z.object({
  id: causeIdSchema,
  /** udzial w wyjasnieniu niedoboru, 0-1 (suma wag przyczyn nie musi dawac 1) */
  weight: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema).min(1),
});

export type Cause = z.infer<typeof causeSchema>;

/** Dzialania z katalogu (apps/server/src/domain - pakiet P9); nazwy i opisy sa w tlumaczeniach. */
export const MEASURE_IDS = [
  'small_pond',
  'ditch_weir',
  'protect_wetland',
  'grassed_waterway',
  'field_margin_trees',
  'contour_farming',
  'cover_crop',
  'mulch_residue',
  'reduced_tillage',
  'organic_matter',
  'subsoiling',
  'crop_choice',
] as const;

export const measureIdSchema = z.enum(MEASURE_IDS);

export type MeasureId = z.infer<typeof measureIdSchema>;

export const recommendationSchema = z.object({
  measure: measureIdSchema,
  category: z.enum(['retention', 'agrotech']),
  /** 1 = zacznij od tego */
  priority: z.number().int().min(1).max(3),
  /** przyczyny, na ktore odpowiada dzialanie - bez przyczyny nie ma zalecenia */
  causes: z.array(causeIdSchema).min(1),
  evidence: z.array(evidenceSchema).min(1),
  /** strefa na polu, ktorej dotyczy (null = cale pole) */
  zoneId: z.string().nullable(),
  /** szacunek efektu, gdy sa podstawy: objetosc, slup wody albo ograniczenie parowania */
  effect: z
    .object({ kind: z.enum(['volume_m3', 'water_mm', 'evaporation_pct']), value: z.number() })
    .nullable(),
  effort: z.enum(['low', 'medium', 'high']),
  /** formalnosci wodnoprawne: brak, zgloszenie/powiadomienie, pozwolenie */
  legal: z.enum(['none', 'notification', 'permit']),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/** Wskazowka nawadniania - zawsze po retencji i agrotechnice, tylko gdy bilans ja uzasadnia. */
export const irrigationAdviceSchema = z.object({
  advisable: z.enum(['no', 'consider', 'yes']),
  /** dawka netto do uzupelnienia latwo dostepnej wody */
  netDepthMm: z.number().nullable(),
  /** w ciagu ilu dni; null gdy brak prognozy (np. data historyczna) */
  withinDays: z.number().int().min(0).nullable(),
  forecastPrecipMm: z.number().nullable(),
});

export type IrrigationAdvice = z.infer<typeof irrigationAdviceSchema>;

export const ZONE_KINDS = ['drying', 'collecting', 'typical', 'depression', 'flow_path', 'segment'] as const;

export const zoneLineSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

export const zoneSchema = z.object({
  id: z.string(),
  kind: z.enum(ZONE_KINDS),
  areaHa: z.number(),
  geometry: z.union([parcelGeometrySchema, zoneLineSchema]),
  /** cechy strefy: nachylenie, wskaznik gromadzenia wody, roznica wilgotnosci roslin wzgledem pola, pojemnosc */
  slopePct: z.number().optional(),
  wetnessIndex: z.number().optional(),
  ndmiDelta: z.number().optional(),
  volumeM3: z.number().optional(),
});

export type Zone = z.infer<typeof zoneSchema>;

/**
 * Podzial pola na strefy (z komorek siatki) albo - dla dzialek wezszych niz kilka pikseli - na odcinki wzdluz osi
 * pola (`profile`).
 */
export const zoneMapSchema = z.object({
  layout: z.enum(['zones', 'profile']),
  cellSizeM: z.number().positive(),
  cells: z.number().int().min(0),
  zones: z.array(zoneSchema),
});

export type ZoneMap = z.infer<typeof zoneMapSchema>;

/** Ograniczenia, o ktorych raport mowi wprost (teksty w tlumaczeniach). */
export const LIMITATION_IDS = [
  'sample_data',
  'meteo_missing',
  'meteo_coarse_grid',
  'soil_estimated',
  'soil_missing',
  'terrain_missing',
  'terrain_coarse',
  'hydro_missing',
  'vegetation_missing',
  'vegetation_few_pixels',
  'vegetation_before_archive',
  'forecast_missing',
  'out_of_season',
  'crop_not_monitored',
  'balance_estimated',
  'current_boundaries',
  'no_in_situ_measurement',
  'field_verification_needed',
] as const;

export const limitationIdSchema = z.enum(LIMITATION_IDS);

export type LimitationId = z.infer<typeof limitationIdSchema>;

export const waterReportSchema = z.object({
  meta: z.object({
    reportId: z.string(),
    engineVersion: z.string(),
    analysisDate: isoDateSchema,
    generatedAt: z.string(),
    durationMs: z.number().int().min(0),
    /** complete = wszystkie zrodla; partial = czesc danych brak; insufficient = za malo na ocene */
    status: z.enum(['complete', 'partial', 'insufficient']),
    /** raport z danych przykladowych (atrapy) - nie wolno go pokazac jako wyniku dla dzialki */
    sample: z.boolean(),
    /**
     * Czesci raportu liczone jeszcze przykladowymi regulami (nie metodyka docelowa). Brak pola = jak przy `sample`.
     * Zrodla danych przykladowych oznacza osobno `sources[].sample`.
     */
    sampleParts: z.array(reportPartSchema).optional(),
  }),
  field: fieldAreaSchema,
  crop: cropAtDateSchema,
  assessment: assessmentSchema,
  history: historySchema,
  causes: z.array(causeSchema),
  recommendations: z.object({
    retention: z.array(recommendationSchema),
    agrotech: z.array(recommendationSchema),
    irrigation: irrigationAdviceSchema.nullable(),
  }),
  zones: zoneMapSchema.nullable(),
  sources: z.array(sourceRefSchema),
  limitations: z.array(limitationIdSchema),
});

export type WaterReport = z.infer<typeof waterReportSchema>;
