// "Zbiornik wody w glebie" w dniu analizy (report.waterNow): ile procent wody dostepnej dla roslin zostalo w strefie
// korzeni wg dobowego bilansu FAO-56, ile bywa zwykle tego dnia w latach tla i za ile dni zapas spadnie ponizej
// progu stresu (Dr > RAW, czyli ponizej (1 - p) TAW) - bez deszczu i z prognoza. Czysta funkcja na symulacji bilansu;
// nie zmienia oceny. Poza sezonem uprawy oddaje tylko zapas.
import type { CropId, WaterNow } from '@app/contracts';

import type { ForecastSeries } from '../analysis-ports';
import { cropAtDate } from '../crop-calendar';
import { cropProfile } from '../crops';
import { backgroundYears } from '../history';
import { addDays, withYear } from '../iso-date';
import type { RootZoneDay } from '../root-zone-balance';

/** z ilu ostatnich dni srednie ET0 do odliczania */
export const RECENT_USE_DAYS = 7;
/** jak daleko liczymy w przod; dalej "nie w horyzoncie" */
export const STRESS_HORIZON_DAYS = 60;

const BASIS =
  'Model bilansu wody w strefie korzeni (FAO-56) z pogody i gleby z map, nie pomiar w polu. Odliczanie: zużycie = Kc uprawy × średnie ET0 z ostatnich 7 dni, bez deszczu; wariant z prognozą bierze opad i ET0 z prognozy na jej dni.';
const BASIS_OFF_SEASON =
  'Model bilansu wody w strefie korzeni (FAO-56) z pogody i gleby z map, nie pomiar w polu. Uprawa jest poza sezonem wzrostu, więc pokazujemy tylko zapas wody w glebie.';

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** Procent wody dostepnej (TAW - Dr) / TAW, 0-100. */
export function availablePctOf(day: Pick<RootZoneDay, 'totalAvailableMm' | 'depletionMm'>): number {
  if (day.totalAvailableMm <= 0) return 0;

  const share = (day.totalAvailableMm - day.depletionMm) / day.totalAvailableMm;

  return Math.round(Math.min(Math.max(share, 0), 1) * 100);
}

/** Mediana; null dla pustej listy. */
export function median(values: readonly number[]): number | null {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) return null;

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Mediana procentu zapasu w tym samym dniu kalendarzowym lat tla (z tej samej symulacji). */
export function typicalAvailablePct(
  days: readonly RootZoneDay[],
  date: string,
): { pct: number; years: number } | null {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const values = backgroundYears(date).flatMap((year) => {
    const day = byDate.get(withYear(date, year));

    return day ? [availablePctOf(day)] : [];
  });
  const typical = median(values);

  return typical === null ? null : { pct: Math.round(typical), years: values.length };
}

export interface StressCountdownInput {
  cropId: CropId;
  date: string;
  depletionMm: number;
  readilyAvailableMm: number;
  /** srednie ET0 z ostatnich dni (mm/dobe) - zuzycie dni bez prognozy */
  meanEt0Mm: number;
  /** dni prognozy od dnia po dacie analizy; brak = bez deszczu */
  forecast?: ForecastSeries['days'];
  horizonDays?: number;
}

/**
 * Dzien (1 = jutro), w ktorym wyczerpanie przekroczy RAW; 0 = juz przekroczone; null = nie w horyzoncie albo uprawa
 * konczy sezon wczesniej. Przed progiem Ks = 1, wiec zuzycie = Kc ET0 (bez redukcji ze stresu).
 */
export function daysToStress(input: StressCountdownInput): number | null {
  const { depletionMm, readilyAvailableMm: raw, horizonDays = STRESS_HORIZON_DAYS } = input;

  if (depletionMm > raw) return 0;

  const forecast = new Map((input.forecast ?? []).map((day) => [day.date, day]));
  let depletion = depletionMm;

  for (let index = 1; index <= horizonDays; index += 1) {
    const date = addDays(input.date, index);
    const { kc } = cropAtDate(input.cropId, date);

    if (kc === null) return null;

    const predicted = forecast.get(date);
    const et0 = predicted?.et0Mm ?? input.meanEt0Mm;

    depletion = Math.max(0, depletion + kc * et0 - (predicted?.precipMm ?? 0));

    if (depletion > raw) return index;
  }

  return null;
}

/** Ile dni z rzedu (wlacznie z ostatnim) wyczerpanie przekracza RAW. */
function stressStreak(days: readonly RootZoneDay[]): number {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];

    // to samo kryterium co dni stresu w sezonie (ocena, historia): uprawa rosnie i Ks < 1 - inaczej seria bywala
    // dluzsza niz liczba dni stresu w calym sezonie
    if (!day || day.kc === null || day.stressCoefficient >= 1) break;

    streak += 1;
  }

  return streak;
}

export interface WaterNowInput {
  cropId: CropId;
  date: string;
  /** symulacja bilansu do daty analizy wlacznie */
  days: readonly RootZoneDay[];
  forecast: ForecastSeries | null;
}

export function waterNow({ cropId, date, days, forecast }: WaterNowInput): WaterNow | null {
  const today = days.at(-1);

  if (!today || today.date !== date) return null;

  const typical = typicalAvailablePct(days, date);
  const base = {
    availablePct: availablePctOf(today),
    ...(typical ? { typicalPct: typical.pct, typicalYears: typical.years } : {}),
    availableMm: round(Math.max(today.totalAvailableMm - today.depletionMm, 0)),
    capacityMm: round(today.totalAvailableMm),
    rootDepthM: round(today.rootDepthM, 2),
  };

  if (today.kc === null) return { growing: false, ...base, basis: BASIS_OFF_SEASON };

  const recent = days.slice(-RECENT_USE_DAYS);
  const meanEt0Mm = recent.reduce((sum, day) => sum + day.et0Mm, 0) / recent.length;
  const recentUse = recent.reduce((sum, day) => sum + day.potentialEtcMm, 0) / recent.length;
  const countdown = {
    cropId,
    date,
    depletionMm: today.depletionMm,
    readilyAvailableMm: today.readilyAvailableMm,
    meanEt0Mm,
  };
  const noRain = daysToStress(countdown);
  const withForecast =
    forecast && forecast.days.length > 0 ? daysToStress({ ...countdown, forecast: forecast.days }) : null;
  const streak = stressStreak(days);

  return {
    growing: true,
    ...base,
    stressBelowPct: Math.round((1 - cropProfile(cropId).depletionFraction) * 100),
    ...(noRain === null ? {} : { daysToStressNoRain: noRain }),
    ...(withForecast === null ? {} : { daysToStressWithForecast: withForecast }),
    horizonDays: STRESS_HORIZON_DAYS,
    recentUseMmPerDay: round(recentUse),
    ...(streak > 0 ? { stressedSinceDays: streak } : {}),
    basis: BASIS,
  };
}
