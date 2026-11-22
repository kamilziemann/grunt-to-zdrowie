// Pola "Pogodynki wody" (silnik 0.8.0): zbiornik wody, prognoza, rachunek wody, seria dzienna, satelita w sezonie,
// udzial przyczyn i tryb zrodel. Do czasu scalenia kontraktu (`claude-kamil`) schematy sa tu - te same nazwy i
// granice co w `packages/contracts`. Kazde pole jest opcjonalne i czytane osobno: stary raport z zapisu albo
// niepelne pole daje `undefined` (sekcja znika), a nie blad calego ekranu.
import type { Cause, SourceRef, WaterReport } from '@app/contracts';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const waterNowSchema = z.object({
  growing: z.boolean(),
  availablePct: z.number().min(0).max(100),
  typicalPct: z.number().min(0).max(100).optional(),
  typicalYears: z.number().int().min(0).optional(),
  stressBelowPct: z.number().min(0).max(100).optional(),
  availableMm: z.number().min(0),
  capacityMm: z.number().min(0),
  rootDepthM: z.number().min(0),
  daysToStressNoRain: z.number().int().min(0).optional(),
  daysToStressWithForecast: z.number().int().min(0).optional(),
  horizonDays: z.number().int().positive().optional(),
  recentUseMmPerDay: z.number().min(0).optional(),
  stressedSinceDays: z.number().int().positive().optional(),
  basis: z.string(),
});

const forecastSchema = z.object({
  days: z.array(
    z.object({
      date: isoDate,
      precipitationMm: z.number().min(0).optional(),
      tMaxC: z.number().optional(),
      tMinC: z.number().optional(),
      et0Mm: z.number().min(0).optional(),
    }),
  ),
  source: z.string(),
  issuedAt: z.string().optional(),
});

const waterLedgerSchema = z.object({
  from: isoDate,
  to: isoDate,
  startStorageMm: z.number(),
  precipitationMm: z.number().min(0),
  cropUseMm: z.number().min(0),
  lostBelowRootsMm: z.number().min(0),
  endStorageMm: z.number(),
  shortfallMm: z.number().min(0),
  missingWeatherDays: z.number().int().min(0).optional(),
});

const dailyWaterSchema = z.object({
  date: isoDate,
  precipitationMm: z.number().min(0).optional(),
  etcMm: z.number().min(0),
  etaMm: z.number().min(0).optional(),
  availablePct: z.number().min(0).max(100),
});

const indexRangeSchema = z.object({ min: z.number(), median: z.number(), max: z.number() });

const vegetationSeriesSchema = z.object({
  from: isoDate,
  to: isoDate,
  observations: z.array(
    z.object({
      date: isoDate,
      ndvi: z.number().nullable(),
      ndmi: z.number().nullable(),
      validShare: z.number().min(0).max(1),
      used: z.boolean(),
    }),
  ),
  baseline: z
    .object({
      years: z.number().int().positive(),
      ndvi: indexRangeSchema.optional(),
      ndmi: indexRangeSchema.optional(),
    })
    .optional(),
});

export type WaterNow = z.infer<typeof waterNowSchema>;
export type Forecast = z.infer<typeof forecastSchema>;
export type ForecastDay = Forecast['days'][number];
export type WaterLedger = z.infer<typeof waterLedgerSchema>;
export type DailyWater = z.infer<typeof dailyWaterSchema>;
export type VegetationSeries = z.infer<typeof vegetationSeriesSchema>;
export type VegetationObservation = VegetationSeries['observations'][number];
export type SourceMode = 'live' | 'preloaded';

export interface ReportExtras {
  waterNow?: WaterNow;
  forecast?: Forecast;
  waterLedger?: WaterLedger;
  dailySeries?: DailyWater[];
  vegetationSeries?: VegetationSeries;
}

/** Raport z polami 0.8.0 (fixtures i testy); przypisywalny do `WaterReport`. */
export type ExtendedReport = Omit<WaterReport, 'causes' | 'sources'> &
  ReportExtras & {
    causes: (Cause & { share?: number })[];
    sources: (SourceRef & { mode?: SourceMode })[];
  };

function field<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

const cache = new WeakMap<WaterReport, ReportExtras>();

/** Pola 0.8.0 raportu; niepoprawne albo brakujace = `undefined` (raz na raport, wynik w pamieci). */
export function reportExtras(report: WaterReport): ReportExtras {
  const known = cache.get(report);

  if (known) return known;
  const raw = report as WaterReport & Record<string, unknown>;
  const dailySeries = field(z.array(dailyWaterSchema), raw.dailySeries);
  const forecast = field(forecastSchema, raw.forecast);
  const extras: ReportExtras = {
    waterNow: field(waterNowSchema, raw.waterNow),
    forecast: forecast && forecast.days.length > 0 ? forecast : undefined,
    waterLedger: field(waterLedgerSchema, raw.waterLedger),
    dailySeries: dailySeries && dailySeries.length > 1 ? dailySeries : undefined,
    vegetationSeries: field(vegetationSeriesSchema, raw.vegetationSeries),
  };

  cache.set(report, extras);

  return extras;
}

/** Udzial przyczyny 0-1: `share` z silnika 0.8.0, a dla starszego raportu waga podzielona przez sume wag. */
export function causeShare(cause: Cause, causes: readonly Cause[]): number | null {
  const share = field(z.number().min(0).max(1), (cause as Cause & { share?: unknown }).share);

  if (share !== undefined) return share;
  const total = causes.reduce((sum, item) => sum + item.weight, 0);

  return total > 0 ? cause.weight / total : null;
}

/** Tryb zrodla (na biezaco / wczesniej zaimportowane); brak = raport sprzed 0.8.0. */
export function sourceMode(source: SourceRef): SourceMode | undefined {
  return field(z.enum(['live', 'preloaded']), (source as SourceRef & { mode?: unknown }).mode);
}

export interface WaterTank {
  /** woda dostepna dla roslin, 0-100 % pelnego zbiornika */
  availablePct: number;
  availableMm: number;
  capacityMm: number;
  /** ponizej tej linii rosliny cierpia; brak poza sezonem uprawy */
  stressBelowPct?: number;
  /** zwykle w tym dniu (mediana lat tla) - tylko z silnika 0.8.0 */
  typicalPct?: number;
  typicalYears?: number;
  rootDepthM: number | null;
  growing: boolean;
}

/**
 * Zbiornik wody w glebie: z `waterNow` (0.8.0), a dla starszego raportu z bilansu strefy korzeniowej w dacie
 * analizy (te same wzory: zapas = TAW - wyczerpanie, prog stresu = TAW - RAW). Bez bilansu - null.
 */
export function waterTank(report: WaterReport): WaterTank | null {
  const now = reportExtras(report).waterNow;

  if (now) {
    return {
      availablePct: now.availablePct,
      availableMm: now.availableMm,
      capacityMm: now.capacityMm,
      stressBelowPct: now.growing ? now.stressBelowPct : undefined,
      typicalPct: now.typicalPct,
      typicalYears: now.typicalYears,
      rootDepthM: now.rootDepthM,
      growing: now.growing,
    };
  }

  const zone = report.assessment.rootZone;

  if (!zone || zone.totalAvailableMm <= 0) return null;
  const growing = report.crop.kc !== null;

  return {
    availablePct: Math.round((1 - zone.depletionShare) * 100),
    availableMm: Math.max(0, zone.totalAvailableMm - zone.depletionMm),
    capacityMm: zone.totalAvailableMm,
    stressBelowPct: growing
      ? Math.round(((zone.totalAvailableMm - zone.readilyAvailableMm) / zone.totalAvailableMm) * 100)
      : undefined,
    rootDepthM: report.crop.rootDepthM,
    growing,
  };
}
