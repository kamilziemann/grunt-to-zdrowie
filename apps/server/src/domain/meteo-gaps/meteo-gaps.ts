// Luki w serii pogody dobowej: opoznienie publikacji (ostatnie dni przed koncem serii, ktorych zrodlo jeszcze nie
// wydalo - NASA POWER uzupelnia je po kilku dniach) to co innego niz prawdziwa luka w srodku serii. Opoznienie jest
// przewidywalne i dotyczy prawie kazdej analizy "na dzis" - nie moze samo obnizac pewnosci ani robic z raportu
// "czesciowego". Prawdziwe luki tak.
import type { DailyWeather } from '../analysis-ports';

/** Najdluzsze opoznienie publikacji traktowane jako zwykle (NASA POWER: zwykle 2-5 dni). */
export const PUBLICATION_LAG_DAYS = 7;

/** Udzial prawdziwych luk w serii, od ktorego pewnosc oceny spada (1% = ok. 37 dni z 10 lat). */
export const METEO_GAP_SHARE = 0.01;

export interface MeteoGaps {
  /** ostatnie dni serii bez danych, jeszcze nieopublikowane (najwyzej PUBLICATION_LAG_DAYS) */
  lagDays: number;
  /** dni bez danych poza opoznieniem publikacji */
  gapDays: number;
  /** wszystkie dni serii */
  totalDays: number;
}

/** Dzien z opadem i obiema temperaturami - bez nich nie ma bilansu. */
export function isCompleteDay(day: DailyWeather): boolean {
  return day.precipMm !== null && day.tMinC !== null && day.tMaxC !== null;
}

export function meteoGaps(days: readonly DailyWeather[]): MeteoGaps {
  let trailing = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];

    if (!day || isCompleteDay(day)) break;

    trailing += 1;
  }

  const missing = days.filter((day) => !isCompleteDay(day)).length;
  const lagDays = trailing <= PUBLICATION_LAG_DAYS && trailing < days.length ? trailing : 0;

  return { lagDays, gapDays: missing - lagDays, totalDays: days.length };
}

/** Czy luki sa na tyle duze, zeby oslabic ocene (opoznienie publikacji sie nie liczy). */
export function hasMeaningfulGaps(gaps: MeteoGaps): boolean {
  return gaps.totalDays > 0 && gaps.gapDays / gaps.totalDays >= METEO_GAP_SHARE;
}
