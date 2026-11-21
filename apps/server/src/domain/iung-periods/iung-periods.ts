// Okresy raportowania Systemu Monitoringu Suszy Rolniczej IUNG-PIB: 14 okresow szesciodekadowych miedzy
// 21 marca a 30 wrzesnia (https://susza.iung.pulawy.pl/raporty/). Klimatyczny bilans wodny liczy sie dla okresu,
// a progi suszy (pakiet P2) sa podane dla numeru okresu.
import { isoDate, yearOf } from '../iso-date';

export interface IungPeriod {
  /** numer okresu 1-14 */
  no: number;
  from: string;
  to: string;
}

/** [miesiac, dzien] poczatku i konca kazdego okresu. */
const PERIODS: readonly (readonly [number, number, number, number])[] = [
  [3, 21, 5, 20],
  [4, 1, 5, 31],
  [4, 11, 6, 10],
  [4, 21, 6, 20],
  [5, 1, 6, 30],
  [5, 11, 7, 10],
  [5, 21, 7, 20],
  [6, 1, 7, 31],
  [6, 11, 8, 10],
  [6, 21, 8, 20],
  [7, 1, 8, 31],
  [7, 11, 9, 10],
  [7, 21, 9, 20],
  [8, 1, 9, 30],
];

export const IUNG_PERIOD_COUNT = PERIODS.length;

export function iungPeriods(year: number): IungPeriod[] {
  return PERIODS.map(([fromMonth, fromDay, toMonth, toDay], index) => ({
    no: index + 1,
    from: isoDate(year, fromMonth, fromDay),
    to: isoDate(year, toMonth, toDay),
  }));
}

/**
 * Ostatni okres zakonczony najpozniej w dacie analizy (nie uzywamy pogody po tej dacie). Null = przed koncem
 * pierwszego okresu (20 maja) albo po sezonie - wtedy progi suszy rolniczej nie maja zastosowania.
 */
export function iungPeriodEndingBy(date: string): IungPeriod | null {
  const periods = iungPeriods(yearOf(date));
  const seasonEnd = periods.at(-1)?.to ?? date;

  if (date > seasonEnd) return null;

  return periods.findLast((period) => period.to <= date) ?? null;
}
