// Dni upalne (temperatura maksymalna powyzej 30°C, definicja IMGW-PIB) przed data analizy i ich norma z 10 lat.
// To wyjasnienie dla rolnika, nie skladnik oceny: upal liczy sie juz w parowaniu (ET0), wiec poziomu oceny nie
// zmienia. Dowody ida do przyczyny `high_evaporative_demand`, a bez niej - do oceny, gdy upalow jest wyraznie
// wiecej niz zwykle.
import type { Assessment, Cause, Evidence } from '@app/contracts';

import type { DailyWeather } from '../analysis-ports';
import { addDays, addYears, yearOf } from '../iso-date';

/** IMGW-PIB: dzien upalny = temperatura maksymalna powyzej 30°C. */
export const HOT_DAY_TMAX_C = 30;

const BACKGROUND_YEARS = 10;
/** norma z mniej niz tylu lat to nie norma - wtedy jej nie podajemy */
const MIN_BACKGROUND_YEARS = 5;
/** okno liczymy, gdy dane ma co najmniej polowa dni (NASA POWER spoznia sie o kilka dni) */
const MIN_COVERAGE = 0.5;
/** "wyraznie wiecej niz zwykle": co najmniej o 3 dni i co najmniej dwa razy tyle co norma */
const CLEARLY_MORE_DAYS = 3;
const CLEARLY_MORE_RATIO = 2;

export interface HotDays {
  /** dni upalne w 14 i 30 dniach konczacych sie data analizy (wlacznie); null = za malo dni z danymi */
  last14: number | null;
  last30: number | null;
  /** srednia liczba dni upalnych w tych samych 30 dniach kalendarzowych z lat tla; null = mniej niz 5 lat */
  normal30: number | null;
  /** z ilu lat policzono norme (do 10) */
  backgroundYears: number;
}

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** Dni upalne w `length` dniach konczacych sie na `end`; null, gdy dane ma mniej niz polowa dni. */
function countHot(byDate: ReadonlyMap<string, number | null>, end: string, length: number): number | null {
  let known = 0;
  let hot = 0;

  for (let offset = 0; offset < length; offset += 1) {
    const tMax = byDate.get(addDays(end, -offset));

    if (tMax === null || tMax === undefined) continue;

    known += 1;

    if (tMax > HOT_DAY_TMAX_C) hot += 1;
  }

  return known >= length * MIN_COVERAGE ? hot : null;
}

export function hotDays(days: readonly DailyWeather[], date: string): HotDays {
  const byDate = new Map(days.map((day) => [day.date, day.tMaxC]));
  const background = Array.from({ length: BACKGROUND_YEARS }, (_unused, index) =>
    countHot(byDate, addYears(date, -(index + 1)), 30),
  ).filter((count): count is number => count !== null);
  const normal =
    background.length >= MIN_BACKGROUND_YEARS
      ? background.reduce((sum, count) => sum + count, 0) / background.length
      : null;

  return {
    last14: countHot(byDate, date, 14),
    last30: countHot(byDate, date, 30),
    normal30: normal === null ? null : round(normal),
    backgroundYears: background.length,
  };
}

/** Upalow wyraznie wiecej niz zwykle - wtedy dowody trafiaja do raportu takze bez przyczyny pogodowej. */
export function clearlyHotterThanUsual({ last30, normal30 }: HotDays): boolean {
  if (last30 === null || normal30 === null) return false;

  return last30 - normal30 >= CLEARLY_MORE_DAYS && last30 >= normal30 * CLEARLY_MORE_RATIO;
}

const GRID_NOTE =
  'Temperatura z siatki NASA POWER (komórka ok. 50 km) — upały na samym polu mogą być mocniejsze niż w tej średniej.';

/** Dowody: `hot_days_14d`, `hot_days_30d` (odniesienie = norma) i `hot_days_30d_normal`. */
export function hotDaysEvidence(stats: HotDays, date: string): Evidence[] {
  const { last14, last30, normal30, backgroundYears } = stats;
  const evidence: Evidence[] = [];

  if (last14 !== null) {
    evidence.push({ metric: 'hot_days_14d', value: last14, unit: 'days', source: 'meteo', note: GRID_NOTE });
  }

  if (last30 !== null) {
    evidence.push({
      metric: 'hot_days_30d',
      value: last30,
      unit: 'days',
      ...(normal30 === null ? {} : { reference: normal30 }),
      source: 'meteo',
      note: GRID_NOTE,
    });
  }

  if (last30 !== null && normal30 !== null) {
    const year = yearOf(date);

    evidence.push({
      metric: 'hot_days_30d_normal',
      value: normal30,
      unit: 'days',
      source: 'meteo',
      note: `Średnio w tych samych 30 dniach w latach ${year - BACKGROUND_YEARS}–${year - 1} (z ${backgroundYears} lat z danymi).`,
    });
  }

  return evidence;
}

/**
 * Dni upalne w raporcie: przy przyczynie `high_evaporative_demand` (gdy jest), a bez niej w ocenie - tylko gdy upalow
 * jest wyraznie wiecej niz zwykle. Poziom oceny i wagi przyczyn sie nie zmieniaja.
 */
export function withHotDays(
  days: readonly DailyWeather[] | undefined,
  date: string,
  assessment: Assessment,
  causes: readonly Cause[],
): { assessment: Assessment; causes: Cause[] } {
  const stats = days ? hotDays(days, date) : null;
  const evidence = stats ? hotDaysEvidence(stats, date) : [];
  const demand = causes.find((cause) => cause.id === 'high_evaporative_demand');

  if (evidence.length === 0) return { assessment, causes: [...causes] };

  if (demand) {
    return {
      assessment,
      causes: causes.map((cause) =>
        cause === demand ? { ...cause, evidence: [...cause.evidence, ...evidence] } : cause,
      ),
    };
  }

  if (!stats || !clearlyHotterThanUsual(stats)) return { assessment, causes: [...causes] };

  return {
    assessment: { ...assessment, evidence: [...(assessment.evidence ?? []), ...evidence] },
    causes: [...causes],
  };
}
