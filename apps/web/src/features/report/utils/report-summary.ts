// Pierwsza czesc raportu ("Pogodynka wody", nad szczegolami): skala pieciu poziomow, "sucho w N z 10", pierwszy
// krok z plakietka i podsumowania wykresow. Tylko liczby z raportu - zdania powstaja w komponentach z tlumaczen.
import type { AssessmentLevel, Evidence, Recommendation, WaterReport } from '@app/contracts';

import type { DailyWater, ForecastDay, VegetationObservation, WaterLedger } from './report-extras';
import { byPriority, seasonRows } from './report-data';

/** Skala od mokro do bardzo sucho; poza sezonem i bez oceny - brak miejsca na skali. */
export const SCALE_STEPS = ['wet', 'good', 'slightlyDry', 'dry', 'veryDry'] as const;

export type ScaleStep = (typeof SCALE_STEPS)[number];

const LEVEL_STEP: Partial<Record<AssessmentLevel, ScaleStep>> = {
  excess: 'wet',
  ok: 'good',
  watch: 'slightlyDry',
  risk: 'dry',
  drought: 'veryDry',
};

export function scaleStep(level: AssessmentLevel): ScaleStep | null {
  return LEVEL_STEP[level] ?? null;
}

/** "Sucho w N z M sezonow": niedobor wg bilansu strefy korzeni (albo prog IUNG w starszym raporcie). */
export function drySeasons(report: WaterReport): { dry: number; total: number } | null {
  const { history } = report;

  if (history.seasonsWithData === 0) return null;

  return { dry: history.deficitSeasons ?? history.droughtSeasons, total: history.seasonsWithData };
}

export interface SeasonBar {
  year: number;
  stressDays: number | null;
  /** sezon z susza rolnicza wg progow IUNG */
  drought: boolean;
  current: boolean;
}

/** Slupki sezonow: dni z niedoborem wody w kolejnych latach, biezacy na koncu. */
export function seasonBars(report: WaterReport): SeasonBar[] {
  return seasonRows(report).map((row) => ({
    year: row.year,
    stressDays: row.stressDays,
    drought: row.droughtPeriods > 0,
    current: row.current,
  }));
}

/** Kolejne miesiace ryzyka jako zakres (5, 6, 7 -> [5, 7]); rozrzucone - pierwszy i ostatni. */
export function riskMonthRange(months: readonly number[]): [number, number] | null {
  const sorted = months.toSorted((a, b) => a - b);
  const first = sorted[0];
  const last = sorted.at(-1);

  return first === undefined || last === undefined ? null : [first, last];
}

/** Zalecenia w kolejnosci raportu: zatrzymaj wode -> gleba (nadmiar wody: bez zatrzymywania). */
export function orderedRecommendations(report: WaterReport): Recommendation[] {
  const retention = report.assessment.level === 'excess' ? [] : byPriority(report.recommendations.retention);

  return [...retention, ...byPriority(report.recommendations.agrotech)];
}

/** Co wolno zrobic od razu, a co najpierw sprawdzic albo uzgodnic - tylko z pol `legal`, `effort` i dopiskow serwera. */
export type StepBadge = 'permit' | 'notification' | 'check' | 'protected' | 'now';

const CHECK_NOTES = new Set([
  'check_existing_structure',
  'structure_nearby',
  'piped_junction',
  'drained_lowland',
]);

export function stepBadge(recommendation: Recommendation): StepBadge | null {
  const notes = recommendation.notes ?? [];

  if (recommendation.legal === 'permit') return 'permit';

  if (recommendation.legal === 'notification') return 'notification';

  if (notes.some((note) => note.id === 'protected_area')) return 'protected';

  if (notes.some((note) => CHECK_NOTES.has(note.id))) return 'check';

  return recommendation.effort === 'low' ? 'now' : null;
}

export interface ForecastSummary {
  totalMm: number;
  /** dzien z najwiekszym deszczem (>= 1 mm); null = sucho */
  wettest: ForecastDay | null;
  rainyDays: number;
}

/** Deszcz >= 1 mm to dzien z deszczem (mniej nie zmienia zapasu wody). */
export const RAIN_DAY_MM = 1;

export function forecastSummary(days: readonly ForecastDay[]): ForecastSummary {
  let wettest: ForecastDay | null = null;
  let totalMm = 0;
  let rainyDays = 0;

  for (const day of days) {
    const mm = day.precipitationMm ?? 0;

    totalMm += mm;

    if (mm >= RAIN_DAY_MM) rainyDays += 1;

    if (mm >= RAIN_DAY_MM && mm > (wettest?.precipitationMm ?? 0)) wettest = day;
  }

  return { totalMm, wettest, rainyDays };
}

/** Ile razy wiecej wody zabraly rosliny i slonce niz spadlo (>= 1,2 - inaczej zdanie "mniej wiecej tyle"). */
export function ledgerRatio(ledger: WaterLedger): number | null {
  if (ledger.precipitationMm <= 0) return null;

  return ledger.cropUseMm / ledger.precipitationMm;
}

export interface RainUseSummary {
  rainMm: number;
  useMm: number;
  days: number;
  /** dni bez danych o deszczu (zwykle ostatnie - opoznienie danych); suma deszczu jest wtedy dolna granica */
  gaps: number;
  /**
   * seria dni bez deszczu (< 1 mm) konczaca sie na ostatnim dniu z danymi - luka na koncu to "nie wiemy", nie
   * "nie padalo"
   */
  dryStreak: number;
}

export function rainUseSummary(series: readonly DailyWater[]): RainUseSummary {
  let rainMm = 0;
  let useMm = 0;

  for (const day of series) {
    rainMm += day.precipitationMm ?? 0;
    useMm += day.etcMm;
  }

  let dryStreak = 0;
  const known = series.filter((day) => day.precipitationMm !== undefined);
  const lastKnown = known.at(-1);
  const trailing = lastKnown ? series.slice(series.indexOf(lastKnown) + 1) : series;

  for (const day of series.slice(0, series.length - trailing.length).toReversed()) {
    // luka w srodku przerywa serie - nie wiemy, czy wtedy padalo
    if (day.precipitationMm === undefined || day.precipitationMm >= RAIN_DAY_MM) break;
    dryStreak += 1;
  }

  return { rainMm, useMm, days: series.length, gaps: series.length - known.length, dryStreak };
}

/** Ostatnie uzyte zdjecie z NDMI (wilgotnosc roslin) i liczba pominietych przez chmury. */
export function vegetationSummary(observations: readonly VegetationObservation[]): {
  latest: (VegetationObservation & { ndmi: number }) | null;
  skipped: number;
  used: number;
} {
  const used = observations.filter(
    (item): item is VegetationObservation & { ndmi: number } => item.used && item.ndmi !== null,
  );

  return {
    latest: used.at(-1) ?? null,
    skipped: observations.filter((item) => !item.used).length,
    used: used.length,
  };
}

/** Miara z dowodow raportu (ocena, przyczyny, zalecenia) - pierwsza znaleziona; brak = undefined. */
export function findEvidence(report: WaterReport, metric: string): Evidence | undefined {
  return [
    ...(report.assessment.evidence ?? []),
    ...[...report.causes, ...report.recommendations.retention, ...report.recommendations.agrotech].flatMap(
      (item) => item.evidence,
    ),
  ].find((item) => item.metric === metric);
}

/**
 * Poza sezonem (21 marca - 30 wrzesnia) - dzien w srodku ostatniego sezonu (15 czerwca), zeby jednym kliknieciem
 * zobaczyc, jak bylo latem na tym polu. Jesien = ten sam rok, przedwiosnie = poprzedni.
 */
export function lastSummerDate(report: WaterReport): string | null {
  if (report.assessment.level !== 'out_of_season') return null;
  const [year = 0, month = 1] = report.meta.analysisDate.split('-').map(Number);

  return `${month >= 10 ? year : year - 1}-06-15`;
}
