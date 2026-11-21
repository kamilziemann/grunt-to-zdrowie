// Gospodarstwo (I2): kolejnosc "gdzie dzialac najpierw" dla raportow policzonych osobno dla kazdej dzialki. Najpierw
// poziom (susza przed ryzykiem...), przy rownym poziomie mniejszy zapas wody w glebie, potem suchszy okres na tle lat.
import type { AssessmentLevel, WaterReport } from '@app/contracts';

const LEVEL_ORDER: Record<AssessmentLevel, number> = {
  drought: 0,
  risk: 1,
  excess: 2,
  watch: 3,
  ok: 4,
  unknown: 5,
  out_of_season: 6,
};

export interface FarmRow {
  id: string;
  report: WaterReport | null;
}

function compareReports(a: WaterReport, b: WaterReport): number {
  const level = LEVEL_ORDER[a.assessment.level] - LEVEL_ORDER[b.assessment.level];

  if (level !== 0) return level;
  const depletion =
    (b.assessment.rootZone?.depletionShare ?? 0) - (a.assessment.rootZone?.depletionShare ?? 0);

  if (depletion !== 0) return depletion;

  const rank = (report: WaterReport) => report.assessment.climaticBalance?.rankInHistory?.rank ?? Infinity;

  return rank(a) - rank(b);
}

/** Policzone dzialki od najpilniejszej, niepoliczone na koncu w kolejnosci z listy. */
export function farmOrder<T extends FarmRow>(rows: readonly T[]): T[] {
  const done = rows
    .filter((row): row is T & { report: WaterReport } => row.report !== null)
    .toSorted((a, b) => compareReports(a.report, b.report));

  return [...done, ...rows.filter((row) => row.report === null)];
}

/** Ile zapytan wolno miec w toku naraz - analiza odpytuje zewnetrzne zrodla (NASA POWER, GUGiK). */
export const FARM_CONCURRENCY = 2;

/**
 * Czy zapytanie `index` moze ruszyc: po kolei, najwyzej `FARM_CONCURRENCY` niezakonczonych naraz (zakonczone =
 * z wynikiem albo bledem). Wczesniejsze niezakonczone zajmuja miejsca, wiec kolejka idzie w kolejnosci listy.
 */
export function canStart(settled: readonly boolean[], index: number): boolean {
  // brak wpisu (pierwszy render) = jeszcze niezakonczone
  const waitingBefore = Array.from({ length: index }, (_, before) => settled[before] === true).filter(
    (done) => !done,
  ).length;

  return settled[index] === true || waitingBefore < FARM_CONCURRENCY;
}
