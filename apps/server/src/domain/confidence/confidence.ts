// Poziom pewnosci oceny: zaczynamy od wysokiej i odejmujemy za kazde zrodlo niepewnosci, ktore jury albo doradca
// moze wskazac palcem - gruba siatka pogody, gleba nieznana albo przykladowa, luki w danych, sprzeczne sygnaly
// dwoch bilansow. Reguly sa celowo proste i jawne (kazda ma nazwe), zeby dalo sie je wypisac w raporcie.
import type { Confidence } from '@app/contracts';

export type UncertaintyId =
  | 'coarse_meteo_grid'
  | 'soil_unknown'
  | 'meteo_gaps'
  | 'conflicting_signals'
  | 'no_balance';

export const CONFIDENCE_RULES: Readonly<Record<UncertaintyId, number>> = {
  coarse_meteo_grid: 1,
  soil_unknown: 1,
  meteo_gaps: 1,
  conflicting_signals: 1,
  // bez zadnego bilansu nie ma oceny - pewnosc zawsze niska
  no_balance: 3,
};

const START = 3;

export function confidenceOf(uncertainties: readonly UncertaintyId[]): Confidence {
  const score = [...new Set(uncertainties)].reduce((total, id) => total - CONFIDENCE_RULES[id], START);

  if (score >= 3) return 'high';

  return score === 2 ? 'medium' : 'low';
}
