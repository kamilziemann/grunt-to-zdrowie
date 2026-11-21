// Czyste wyliczenia na raporcie wodnym dla ekranu i wydruku: kolejnosc zalecen i przyczyn, zapas wody w liczbach dla
// rolnika (procent, litry na m2), objetosc dawki na cale pole, siatka kalendarza i znacznik danych przykladowych.
// Raport niesie liczby i identyfikatory, zdania sklada warstwa komponentow z tlumaczen.
import type { Cause, History, Recommendation, RootZone, SourceRef, WaterReport, Zone } from '@app/contracts';

/** Zrodla z danymi przykladowymi (atrapy) - raport musi je nazwac. */
export function sampleSources(report: WaterReport): SourceRef[] {
  return report.sources.filter((source) => source.sample);
}

/** Raport (albo ktores zrodlo) z danych przykladowych - ekran pokazuje baner ostrzegawczy. */
export function isSampleReport(report: WaterReport): boolean {
  return report.meta.sample || report.sources.some((source) => source.sample);
}

/** Zalecenia od najwazniejszego (priorytet 1), przy rownym priorytecie kolejnosc z silnika. */
export function byPriority(recommendations: readonly Recommendation[]): Recommendation[] {
  return recommendations.toSorted((a, b) => a.priority - b.priority);
}

/** Przyczyny od najwiekszego wplywu. */
export function byWeight(causes: readonly Cause[]): Cause[] {
  return causes.toSorted((a, b) => b.weight - a.weight);
}

/** Zapas wody w strefie korzeni po ludzku: procent pelnego zapasu i litry na m2 (1 mm = 1 l/m2). */
export function soilWater(rootZone: RootZone): { percent: number; leftMm: number; totalMm: number } {
  const leftMm = Math.max(0, rootZone.totalAvailableMm - rootZone.depletionMm);

  return {
    percent: Math.round((1 - rootZone.depletionShare) * 100),
    leftMm: Math.round(leftMm),
    totalMm: Math.round(rootZone.totalAvailableMm),
  };
}

/** Objetosc wody na cale pole: 1 mm na 1 ha = 10 m3. */
export function volumeM3(depthMm: number, areaHa: number): number {
  return Math.round(depthMm * areaHa * 10);
}

/** Udzial 0-1 jako liczba procent (zaokraglona). */
export function percentOf(share: number): number {
  return Math.round(share * 100);
}

export type CalendarCell = History['calendar'][number];

export interface CalendarRow {
  year: number;
  /** komorki okresow 1..periods; null = silnik nie podal okresu */
  cells: (CalendarCell | null)[];
}

/** Liczba okresow IUNG w sezonie (21 marca - 30 wrzesnia, co 10 dni po 60 dni). */
export const IUNG_PERIODS = 14;

/** Kalendarz ryzyka jako wiersze lat (rosnaco) i kolumny okresow 1-14. */
export function calendarRows(calendar: History['calendar']): CalendarRow[] {
  const years = [...new Set(calendar.map((cell) => cell.year))].toSorted((a, b) => a - b);

  return years.map((year) => ({
    year,
    cells: Array.from(
      { length: IUNG_PERIODS },
      (_, index) => calendar.find((cell) => cell.year === year && cell.periodNo === index + 1) ?? null,
    ),
  }));
}

/** Najwieksza liczba okresow w sezonie - skala wykresu sezonow (min. 1, zeby nie dzielic przez zero). */
export function seasonScale(seasons: History['seasons']): number {
  return Math.max(1, ...seasons.map((season) => season.monitoredPeriods));
}

/** Strefa, ktorej dotyczy zalecenie (null = cale pole albo brak mapy stref). */
export function zoneOf(report: WaterReport, zoneId: string | null): Zone | null {
  if (!zoneId) return null;

  return report.zones?.zones.find((zone) => zone.id === zoneId) ?? null;
}

/** Dzien RRRR-MM-DD jako Date w poludnie UTC - formatowany w dowolnej strefie daje ten sam dzien. */
export function isoDay(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
