// Raport wodny dla pola: ocena -> historia -> przyczyny -> zalecenia (retencja, agrotechnika, nawadnianie) ->
// strefy na polu -> zrodla i ograniczenia. Raport niesie identyfikatory i liczby; zdania dla rolnika powstaja w
// apps/web z tlumaczen, dzieki czemu raport jest testowalny i dwujezyczny.
import { z } from 'zod';

import { fieldAreaSchema, isoDateSchema, sourceIdSchema, sourceRefSchema } from './analysis';
import { cropIdSchema, cropStageSchema, iungCropGroupSchema } from './crop';
import { parcelGeometrySchema } from './parcel';
import { surroundingsSchema } from './surroundings';

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
  /**
   * miejsce KBW tego okresu wsrod tych samych okresow: rok analizy ("biezacy") i 10 lat tla, te same co w `history`
   * (1 = najsuchszy); `years` = biezacy + lata tla z danymi, czyli najwyzej 11
   */
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
  /**
   * udzial niedoboru ewapotranspiracji uprawy (1 - ETa/ETc) w 60 dniach do daty analizy, 0-1 - przy >= 0,2 plon
   * spada o ok. 20% (Ky ~ 1, FAO-33), czyli tyle, ile kryterium suszy IUNG
   */
  etDeficitShare60d: z.number().min(0).max(1).optional(),
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
  interpretation: z.enum([
    'confirms_deficit',
    'no_signal',
    'not_comparable',
    'possible_other_stress',
    // spadek zwykly dla tej uprawy i fazy (dojrzewanie zboz, pokos laki) - nie stres wodny
    'expected_seasonal',
  ]),
  /** faza uprawy w dniu analizy - od niej zalezy, czy i jak czytamy satelite (od silnika 0.8.4) */
  stage: cropStageSchema.optional(),
  /** prog spadku NDMI dla tej uprawy i fazy (gesty lan -0,05, szerokie rzedy -0,07, dojrzewanie -0,15) */
  thresholdNdmi: z.number().optional(),
  /** dlaczego satelita nie mowi o stresie: rzadka okrywa (wschody), dojrzewanie, pokos */
  reason: z.enum(['sparse_canopy', 'ripening', 'mowing']).optional(),
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
  /**
   * ostatni dzien okna, gdy konczy sie przed dniem analizy (ostatnie dni czekaja na publikacje pogody) - okno ma
   * wtedy pelne `days` dni zmierzonego opadu, a lata poprzednie sa liczone do tego samego dnia roku
   */
  to: isoDateSchema.optional(),
});

/**
 * Skad gleba w bilansie strefy korzeniowej: z pola; z najblizszego obszaru z danymi (w polu brak predykcji - zabudowa,
 * woda); przyjeta gleba srednia (kategoria III), gdy gleby nie ma nigdzie w poblizu - jawne zalozenie.
 */
export const SOIL_BASES = ['field', 'nearby', 'assumed_medium'] as const;

/**
 * Na czym oparto werdykt KBW: kategoria gleby pola; scenariusze czterech kategorii zgodne (gleba nieznana, ale wynik
 * ten sam); scenariusze rozbiezne (na lzejszych glebach susza, na ciezszych nie) - poziom wtedy ostrzega.
 */
export const VERDICT_BASES = ['soil_category', 'scenarios_agree', 'scenarios_disagree'] as const;

/**
 * Pelna lista miar, ktore silnik naprawde emituje w `evidence.metric` (ocena, przyczyny, zalecenia, polder,
 * otoczenie, dni upalne). Strony moga sprawdzic, ze maja etykiete dla kazdej; test w apps/server pilnuje, ze zadna
 * regula nie emituje miary spoza listy. Nowa miara = wpis tutaj i etykieta w apps/web.
 */
export const EVIDENCE_METRICS = [
  // pogoda (NASA POWER) i historia sezonow
  'precip_period',
  'precip_30d',
  'et_period',
  'et0_period',
  'hot_days_14d',
  'hot_days_30d',
  'hot_days_30d_normal',
  'deficit_seasons',
  'drought_seasons',
  'season_et_deficit_median',
  // satelita (Sentinel-2)
  'ndmi_anomaly',
  'ndvi_anomaly',
  // gleba (SoilGrids) i ewidencja
  'available_water_mm_per_m',
  'soil_category',
  'organic_matter_pct',
  'registry_soil_class',
  // teren (model wysokosci)
  'slope_mean_pct',
  'slope_share_above_5_pct',
  'depression_volume_m3',
  'depression_area_m2',
  'elevation_min_m',
  // woda i otoczenie (BDOT10k)
  'nearest_ditch_m',
  'ditch_length_in_field_m',
  'ditches_in_radius',
  'water_bodies_in_radius',
  'wetlands_in_radius',
  'nearest_wetland_m',
  'tree_cover_share',
  'wooded_edge_m',
  'nearest_structure_m',
  'piped_junction_m',
  'nearest_spring_m',
  'nearest_levee_m',
] as const;

export const evidenceMetricSchema = z.enum(EVIDENCE_METRICS);

export type EvidenceMetric = z.infer<typeof evidenceMetricSchema>;

export const evidenceSchema = z.object({
  /**
   * identyfikator miary (tlumaczony w apps/web), np. "precip_30d", "slope_mean_pct". Silnik emituje tylko miary
   * z EVIDENCE_METRICS; transport zostaje tolerancyjny (tekst), zeby stary raport z linku albo nowsza miara nie
   * psuly odczytu - ekran pokazuje wtedy ogolna nazwe
   */
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  /** wartosc odniesienia: prog, mediana, norma */
  reference: z.number().optional(),
  source: sourceIdSchema,
  /** gotowe zdanie po polsku z zastrzezeniem albo kontekstem miary (np. "temperatura z siatki ok. 50 km") */
  note: z.string().optional(),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const assessmentSchema = z.object({
  level: assessmentLevelSchema,
  confidence: confidenceSchema,
  climaticBalance: climaticBalanceSchema.nullable(),
  rootZone: rootZoneSchema.nullable(),
  vegetation: vegetationSignalSchema.nullable(),
  precipitation: precipitationContextSchema.nullable(),
  soilBasis: z.enum(SOIL_BASES).optional(),
  /** dla `soilBasis: 'nearby'` - odleglosc obszaru, z ktorego wzieto glebe, od pola (m) */
  soilDistanceM: z.number().min(0).optional(),
  verdictBasis: z.enum(VERDICT_BASES).optional(),
  /** zakres prawdopodobnych kategorii gleby (z uziarnienia i z wody w profilu), gdy gleba jest z modelu */
  soilCategoryRange: z.tuple([soilCategorySchema, soilCategorySchema]).optional(),
  /**
   * dowody objasniajace ocene, ktore nie zmieniaja jej poziomu - dzis dni upalne, gdy jest ich wyraznie wiecej niz
   * zwykle, a przyczyny "duze parowanie" nie ma (przy niej dowody ida do przyczyny)
   */
  evidence: z.array(evidenceSchema).optional(),
});

export type Assessment = z.infer<typeof assessmentSchema>;

export const periodStatusSchema = z.enum(['drought', 'ok', 'not_monitored', 'missing']);

export const calendarCellSchema = z.object({
  year: z.number().int(),
  periodNo: z.number().int().min(1).max(14),
  status: periodStatusSchema,
  balanceMm: z.number().nullable(),
  /** nadmiar wody: KBW okresu powyzej +50 mm (opad wyraznie wiekszy od parowania) - niezaleznie od progu suszy */
  excess: z.boolean().optional(),
});

export const historySchema = z.object({
  /**
   * ile sezonow tla mialo dane - "prog przekroczony w 4 z 9 sezonow z danymi". Tlo to 10 sezonow przed rokiem
   * analizy (np. 2008-2017 dla 2018); te same lata maja `seasons` i `calendar`, a rok analizy jest w `currentCalendar`
   */
  seasonsWithData: z.number().int().min(0),
  /** sezony z przekroczonym progiem suszy IUNG (dla kategorii gleby pola albo kategorii II, gdy gleba nieznana) */
  droughtSeasons: z.number().int().min(0),
  /**
   * sezony z niedoborem: prog IUNG przekroczony albo uprawie zabraklo >= 50 mm wody wg bilansu strefy korzeniowej -
   * ta liczba idzie do zdania "niedobor w N z 10 sezonow" (na lekkiej glebie bilans widzi niedobor przed progiem)
   */
  deficitSeasons: z.number().int().min(0).optional(),
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
  /** kalendarz ryzyka: rok x okres, tylko lata tla (10 sezonow przed rokiem analizy) */
  calendar: z.array(calendarCellSchema),
  /**
   * okresy biezacego roku (roku analizy), ktore skonczyly sie najpozniej w dniu analizy - osobno od `calendar`, zeby
   * liczniki "w N z 10 lat" liczyly tylko pelne sezony
   */
  currentCalendar: z.array(calendarCellSchema).optional(),
  /** miesiace (1-12), w ktorych niedobor powtarzal sie najczesciej */
  riskMonths: z.array(z.number().int().min(1).max(12)),
});

export type History = z.infer<typeof historySchema>;

/** Czesci raportu, ktore moga byc liczone przykladowo (zanim powstanie wlasciwy etap silnika). */
export const REPORT_PARTS = ['assessment', 'history', 'causes', 'zones', 'recommendations'] as const;

export const reportPartSchema = z.enum(REPORT_PARTS);

export type ReportPart = z.infer<typeof reportPartSchema>;

/** Liczba, na ktorej opiera sie wniosek: co zmierzono, ile, z jakiego zrodla i wzgledem czego. */
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
  /**
   * udzial przyczyny wsrod przyczyn raportu, 0-1, suma = 1: waga podzielona przez sume wag. To szacunek wagi
   * argumentu, nie pomiar, ile mm wody zabrala dana przyczyna. Brak = raport sprzed 0.8.0 albo wszystkie wagi 0.
   */
  share: z.number().min(0).max(1).optional(),
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

/**
 * Dopiski do zalecenia z otoczenia pola: sprawdz istniejace urzadzenie na rowie, jaz w poblizu, styk rowu z rura,
 * obszar chroniony, zrodlo, teren odwadniany mechanicznie. `text` to gotowe zdanie po polsku z liczbami.
 */
export const RECOMMENDATION_NOTE_IDS = [
  'check_existing_structure',
  'structure_nearby',
  'piped_junction',
  'protected_area',
  'spring_nearby',
  'drained_lowland',
] as const;

export const recommendationNoteSchema = z.object({
  id: z.enum(RECOMMENDATION_NOTE_IDS),
  text: z.string(),
});

export type RecommendationNote = z.infer<typeof recommendationNoteSchema>;

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
  /** dopiski z otoczenia pola (gotowe zdania); brak = nic do dodania */
  notes: z.array(recommendationNoteSchema).optional(),
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
  /** dawka jednorazowa realna dla deszczowni (20-30 mm, nie wiecej niz woda latwo dostepna) */
  doseMm: z.number().positive().optional(),
  /** ile takich dawek uzupelni niedobor `netDepthMm` */
  doses: z.number().int().positive().optional(),
  /** co ile dni powtarzac dawke przy obecnym zuzyciu wody przez uprawe */
  intervalDays: z.number().int().positive().optional(),
});

export type IrrigationAdvice = z.infer<typeof irrigationAdviceSchema>;

export const ZONE_KINDS = ['drying', 'collecting', 'typical', 'depression', 'flow_path', 'segment'] as const;

export const ZONE_MOISTURE = ['drier', 'typical', 'wetter'] as const;

export const ZONE_RELIEF = ['hilltop', 'slope', 'hollow', 'flat'] as const;

export const ZONE_POSITIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'centre'] as const;

/**
 * Dlaczego stref nie ma albo jest jedna: pole za male, by wyrozniac miejsca (< 0,5 ha); pole jednorodne (zadne
 * miejsce nie odstaje od reszty); brak danych przestrzennych (bez rastra roslinnosci i modelu terenu); czesci pola
 * (dzialki gospodarstwa) leza tak daleko od siebie, ze nie sa jednym polem do podzialu.
 */
export const ZONE_MAP_REASONS = ['field_too_small', 'uniform', 'no_spatial_data', 'scattered_parts'] as const;

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
  /** udzial powierzchni pola, 0-1 */
  share: z.number().min(0).max(1).optional(),
  /** opis po polsku, np. "Suchsze miejsce na wzniesieniu, w północno-wschodniej części pola, ok. 0,8 ha" */
  description: z.string().optional(),
  /** wilgotnosc wzgledem reszty pola (z NDMI i wskaznika gromadzenia wody) */
  moisture: z.enum(ZONE_MOISTURE).optional(),
  /** polozenie w rzezbie: wzniesienie, stok, obnizenie, plasko (wzgledem reszty pola) */
  relief: z.enum(ZONE_RELIEF).optional(),
  /** czesc pola: strona swiata wzgledem srodka pola albo srodek */
  position: z.enum(ZONE_POSITIONS).optional(),
  /** srednia wysokosc (m n.p.m.) i roznica NDVI wzgledem mediany pola */
  elevationM: z.number().optional(),
  ndviDelta: z.number().optional(),
  /** odleglosc od najblizszego rowu albo cieku (m), gdy jest w poblizu */
  ditchDistanceM: z.number().min(0).optional(),
  /** dla profilu podluznego: poczatek i koniec odcinka w metrach od `profileStart` */
  fromM: z.number().min(0).optional(),
  toM: z.number().min(0).optional(),
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
  reason: z.enum(ZONE_MAP_REASONS).optional(),
  /** z jakich danych powstaly strefy (raster NDMI/NDVI, model terenu, rowy) */
  basis: z.array(z.enum(['vegetation', 'terrain', 'hydro'])).optional(),
  /** okno zdjec Sentinel-2, z ktorych zlozono raster roslinnosci */
  imageFrom: isoDateSchema.optional(),
  imageTo: isoDateSchema.optional(),
  /** profil podluzny: koniec pola, od ktorego licza sie odcinki (strona swiata) */
  profileStart: z.enum(ZONE_POSITIONS).optional(),
});

export type ZoneMap = z.infer<typeof zoneMapSchema>;

/**
 * Rodzaje uzytkow gruntowych z ewidencji (EGiB): grunty uprawne (orne, sady, laki, pastwiska), pozostale grunty
 * rolne (zabudowane, stawy, rowy, zadrzewienia) i grunty nierolne (las, zabudowa, droga, kolej, woda, nieuzytek).
 */
export const LAND_USE_KINDS = [
  'arable',
  'orchard',
  'meadow',
  'pasture',
  'farm_buildings',
  'ponds',
  'ditches',
  'farm_woodland',
  'forest',
  'woodland',
  'built',
  'road',
  'railway',
  'water',
  'wasteland',
  'other',
] as const;

export const landUseKindSchema = z.enum(LAND_USE_KINDS);

export type LandUseKind = z.infer<typeof landUseKindSchema>;

/**
 * Co o gruncie mowi ewidencja. `mismatch: 'non_agricultural'` = zaden uzytek nie jest uprawny (droga, zabudowa,
 * las, woda) - ocena dotyczy warunkow w okolicy, nie uprawy na tej dzialce, a pewnosc jest nizsza;
 * `'grassland_only'` = same laki/pastwiska przy uprawie polowej.
 */
export const landUseSchema = z.object({
  /** klasouzytki z ewidencji, np. ["RIVb", "RV", "ŁV"] */
  codes: z.array(z.string()),
  kinds: z.array(landUseKindSchema),
  /** choc jeden uzytek to grunt uprawny (R, S, Ł, Ps) */
  agricultural: z.boolean(),
  /** klasy bonitacyjne gruntow rolnych od najlepszej, np. ["IVb", "V", "VI"] */
  soilClasses: z.array(z.string()),
  /** podpowiedz uprawy z ewidencji: laki i pastwiska -> uzytki zielone (gdy wybrano inna uprawe) */
  cropHint: z.enum(['grassland']).nullable(),
  mismatch: z.enum(['non_agricultural', 'grassland_only']).nullable(),
  /** powierzchnia ewidencyjna (ha) */
  registryAreaHa: z.number().optional(),
});

export type LandUse = z.infer<typeof landUseSchema>;

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
  'drainage_structures_unknown',
  // ewidencja (EGiB) nie podala uzytku dzialki - raport zaklada pole uprawne
  'land_use_unknown',
  // porownanie satelity z ta sama pora roku nie zna upraw z lat poprzednich (plodozmian)
  'vegetation_rotation_unknown',
  // model gleby i klasa bonitacyjna z ewidencji wyraznie sie roznia - przyjeto glebe wg ewidencji
  'soil_lighter_by_registry',
  'soil_heavier_by_registry',
  // ewidencja nie zna uzytku, a inne dane wskazuja, ze to nie pole: las wg BDOT10k albo brak gleby na mapie glebowej
  'likely_forest',
  'likely_not_farmland',
] as const;

export const limitationIdSchema = z.enum(LIMITATION_IDS);

export type LimitationId = z.infer<typeof limitationIdSchema>;

/**
 * "Zbiornik wody w glebie" w dniu analizy - z dobowego bilansu strefy korzeniowej FAO-56 (model, nie pomiar).
 * Procenty to woda dostepna dla roslin: (TAW - wyczerpanie) / TAW. Poza sezonem uprawy (`growing: false`) raport
 * niesie tylko zapas - bez progu stresu i odliczania, bo uprawa jeszcze (albo juz) nie pobiera wody.
 */
export const waterNowSchema = z.object({
  growing: z.boolean(),
  /** ile procent wody dostepnej zostalo, 0-100 */
  availablePct: z.number().min(0).max(100),
  /** mediana tej samej wartosci w tym samym dniu kalendarzowym w latach tla (10 sezonow przed rokiem analizy) */
  typicalPct: z.number().min(0).max(100).optional(),
  /** z ilu lat tla jest `typicalPct` */
  typicalYears: z.number().int().min(0).optional(),
  /** ponizej tej wartosci rosliny zaczynaja cierpiec: (1 - p) 100, p = frakcja wody latwo dostepnej uprawy */
  stressBelowPct: z.number().min(0).max(100).optional(),
  availableMm: z.number().min(0),
  /** pelny zbiornik: woda dostepna w strefie korzeni (TAW) */
  capacityMm: z.number().min(0),
  rootDepthM: z.number().min(0),
  /**
   * za ile dni bez deszczu zapas spadnie ponizej `stressBelowPct` (1 = jutro); 0 = stres juz trwa. Zuzycie: Kc
   * uprawy w kolejnych dniach x srednie ET0 z ostatnich 7 dni. Brak przy `growing` = nie w horyzoncie `horizonDays`
   */
  daysToStressNoRain: z.number().int().min(0).optional(),
  /** to samo z opadem i ET0 z prognozy (dalej jak bez deszczu); tylko gdy jest prognoza */
  daysToStressWithForecast: z.number().int().min(0).optional(),
  /** horyzont odliczania (dni) */
  horizonDays: z.number().int().positive().optional(),
  /** srednie zuzycie wody przez uprawe (Kc ET0) z ostatnich 7 dni, mm/dobe */
  recentUseMmPerDay: z.number().min(0).optional(),
  /** gdy stres juz trwa: od ilu dni z rzedu (wlacznie z dniem analizy) */
  stressedSinceDays: z.number().int().positive().optional(),
  /** krotka nota o metodzie (po polsku) */
  basis: z.string(),
});

export type WaterNow = z.infer<typeof waterNowSchema>;

/** Prognoza na najblizsze dni (MET Norway) - tylko dla analizy na dzis. */
export const forecastSchema = z.object({
  days: z.array(
    z.object({
      date: isoDateSchema,
      precipitationMm: z.number().min(0).optional(),
      tMaxC: z.number().optional(),
      tMinC: z.number().optional(),
      /** ewapotranspiracja wskaznikowa z temperatur (Hargreaves) */
      et0Mm: z.number().min(0).optional(),
    }),
  ),
  source: z.string(),
  /** kiedy wydano prognoze (ISO 8601), gdy zrodlo to podaje; inaczej chwila pobrania */
  issuedAt: z.string().optional(),
});

export type Forecast = z.infer<typeof forecastSchema>;

/**
 * Rachunek wody w strefie korzeni od `from` do `to` (mm): start + opad - zuzycie - przesiakanie = koniec.
 * `lostBelowRootsMm` to woda, ktora przesiakla ponizej korzeni (model nie liczy splywu po powierzchni).
 * `shortfallMm` jest poza rownaniem: ile wody zabraklo uprawie wzgledem potrzeb (suma ETc - ETc adj w sezonie).
 */
export const waterLedgerSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  /** zapas na poczatku, liczony dla glebokosci korzeni z dnia `to` (model: glebsza warstwa przy pojemnosci polowej) */
  startStorageMm: z.number(),
  precipitationMm: z.number().min(0),
  /** rzeczywiste zuzycie: transpiracja uprawy i parowanie z gleby (ETc adj, poza sezonem gola gleba) */
  cropUseMm: z.number().min(0),
  lostBelowRootsMm: z.number().min(0),
  endStorageMm: z.number(),
  shortfallMm: z.number().min(0),
  /** dni bez danych pogodowych w okresie (opad liczony jako 0) */
  missingWeatherDays: z.number().int().min(0).optional(),
});

export type WaterLedger = z.infer<typeof waterLedgerSchema>;

/** Ostatnie dni do daty analizy, dzien po dniu - do wykresu "deszcz i zuzycie". */
export const dailyWaterSchema = z.object({
  date: isoDateSchema,
  /** brak = luka w danych pogodowych */
  precipitationMm: z.number().min(0).optional(),
  /** potrzeby uprawy Kc ET0 (poza sezonem: parowanie z gleby, Kc 0,35) */
  etcMm: z.number().min(0),
  /** rzeczywiste zuzycie po uwzglednieniu stresu (ETc adj) */
  etaMm: z.number().min(0).optional(),
  availablePct: z.number().min(0).max(100),
});

export const vegetationObservationSchema = z.object({
  date: isoDateSchema,
  ndvi: z.number().nullable(),
  ndmi: z.number().nullable(),
  validShare: z.number().min(0).max(1),
  /** false = pominiete, bo chmury zaslonily wiekszosc pola */
  used: z.boolean(),
});

const indexRangeSchema = z.object({ min: z.number(), median: z.number(), max: z.number() });

/** Zdjecia Sentinel-2 wokol daty analizy (ostatnie 30 dni) i typowy zakres o tej porze w poprzednich latach. */
export const vegetationSeriesSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  observations: z.array(vegetationObservationSchema),
  baseline: z
    .object({
      years: z.number().int().positive(),
      ndvi: indexRangeSchema.optional(),
      ndmi: indexRangeSchema.optional(),
    })
    .optional(),
});

export type VegetationSeriesReport = z.infer<typeof vegetationSeriesSchema>;

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
    /**
     * raport oddany z zapisu (to samo pole, uprawa, data i wersja silnika liczone wczesniej) - `generatedAt` mowi,
     * kiedy go policzono; raport na dzisiejsza date liczymy od nowa po dobie
     */
    reused: z.boolean().optional(),
  }),
  field: fieldAreaSchema,
  /** uzytek gruntowy z ewidencji; brak = obszar narysowany albo ewidencja nie odpowiedziala */
  landUse: landUseSchema.optional(),
  /** otoczenie pola z BDOT10k (drzewa, budowle i waly, obszary chronione); brak = baza nie odpowiedziala */
  surroundings: surroundingsSchema.optional(),
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
  /** "Pogodynka wody" (od 0.8.0); brak = raport starszej wersji albo brak danych pogodowych */
  waterNow: waterNowSchema.optional(),
  forecast: forecastSchema.optional(),
  waterLedger: waterLedgerSchema.optional(),
  dailySeries: z.array(dailyWaterSchema).optional(),
  vegetationSeries: vegetationSeriesSchema.optional(),
});

export type WaterReport = z.infer<typeof waterReportSchema>;

/** Identyfikator zapisanego raportu (`meta.reportId`): skrot klucza pole + uprawa + data + wersja silnika. */
export const REPORT_ID_PATTERN = /^r-[0-9a-f]{8}$/;

export const reportIdParamSchema = z.object({ id: z.string().regex(REPORT_ID_PATTERN) });
