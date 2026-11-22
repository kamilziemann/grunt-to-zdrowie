// Pola "Pogodynki wody" (silnik 0.8.0): zbiornik wody, prognoza, rachunek wody, seria dzienna, satelita w sezonie,
// udzial przyczyn i tryb zrodel - schematy z kontraktu (`@app/contracts`). Kazde pole jest opcjonalne i czytane
// osobno: stary raport z zapisu albo niepelne pole daje `undefined` (sekcja znika), a nie blad calego ekranu.
import {
  dailyWaterSchema,
  forecastSchema,
  vegetationSeriesSchema,
  waterLedgerSchema,
  waterNowSchema,
  type Cause,
  type Forecast,
  type SourceRef,
  type VegetationSeriesReport,
  type WaterLedger,
  type WaterNow,
  type WaterReport,
} from '@app/contracts';
import { z } from 'zod';

export type { Forecast, WaterLedger, WaterNow };
export type ForecastDay = Forecast['days'][number];
export type DailyWater = z.infer<typeof dailyWaterSchema>;
export type VegetationSeries = VegetationSeriesReport;
export type VegetationObservation = VegetationSeries['observations'][number];
export type SourceMode = NonNullable<SourceRef['mode']>;

export interface ReportExtras {
  waterNow?: WaterNow;
  forecast?: Forecast;
  waterLedger?: WaterLedger;
  dailySeries?: DailyWater[];
  vegetationSeries?: VegetationSeries;
}

/** Raport z polami 0.8.0 (fixtures i testy) - od scalenia kontraktu to zwykly `WaterReport`. */
export type ExtendedReport = WaterReport;

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
  // raport z zapisu mogl powstac starszym silnikiem - sprawdzamy kazde pole osobno, zamiast ufac typowi
  const dailySeries = field(z.array(dailyWaterSchema), report.dailySeries);
  const forecast = field(forecastSchema, report.forecast);
  const extras: ReportExtras = {
    waterNow: field(waterNowSchema, report.waterNow),
    forecast: forecast && forecast.days.length > 0 ? forecast : undefined,
    waterLedger: field(waterLedgerSchema, report.waterLedger),
    dailySeries: dailySeries && dailySeries.length > 1 ? dailySeries : undefined,
    vegetationSeries: field(vegetationSeriesSchema, report.vegetationSeries),
  };

  cache.set(report, extras);

  return extras;
}

/** Udzial przyczyny 0-1: `share` z silnika 0.8.0, a dla starszego raportu waga podzielona przez sume wag. */
export function causeShare(cause: Cause, causes: readonly Cause[]): number | null {
  const share = field(z.number().min(0).max(1), cause.share);

  if (share !== undefined) return share;
  const total = causes.reduce((sum, item) => sum + item.weight, 0);

  return total > 0 ? cause.weight / total : null;
}

/** Tryb zrodla (na biezaco / wczesniej zaimportowane); brak = raport sprzed 0.8.0. */
export function sourceMode(source: SourceRef): SourceMode | undefined {
  return source.mode;
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
