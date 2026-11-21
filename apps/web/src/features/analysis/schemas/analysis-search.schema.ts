// Parametry analizy w adresie strony (`/raport?dzialki=...&uprawa=...&data=...`): raport da sie otworzyc z linku i
// odswiezyc. Zle wartosci nie wywracaja strony (`catch`) - ekran mowi wtedy, czego brakuje. Zakres dat (ostatnie
// 10 lat do dzis) liczymy tak jak serwer: dzien kalendarzowy w Polsce.
import {
  ANALYSIS_LIMITS,
  cropIdSchema,
  isoDateSchema,
  parcelSelectionSearchSchema,
  parseParcelSelection,
  serializeParcelSelection,
  type AnalysisRequest,
  type IsoDate,
} from '@app/contracts';
import type { z } from 'zod';

import { APP_TIME_ZONE } from '@/lib/locale';

export const analysisSearchSchema = parcelSelectionSearchSchema.extend({
  uprawa: cropIdSchema.optional().catch(undefined),
  data: isoDateSchema.optional().catch(undefined),
});

export type AnalysisSearch = z.infer<typeof analysisSearchSchema>;

/** Dzisiejsza data w Polsce (RRRR-MM-DD) - ta sama granica, ktora sprawdza serwer. */
export function todayInPoland(now: Date = new Date()): IsoDate {
  // `sv-SE` formatuje date jako RRRR-MM-DD
  return new Intl.DateTimeFormat('sv-SE', { timeZone: APP_TIME_ZONE }).format(now);
}

/** Ten sam dzien `years` lat wczesniej (29 lutego -> 28 lutego). */
function shiftYears(date: IsoDate, years: number): IsoDate {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year + years, month - 1, day));

  if (shifted.getUTCMonth() !== month - 1) shifted.setUTCDate(0);

  return shifted.toISOString().slice(0, 10);
}

/** Zakres dat analizy: od dnia sprzed 10 lat do dzis (wlacznie). */
export function analysisDateBounds(today: IsoDate): { min: IsoDate; max: IsoDate } {
  return { min: shiftYears(today, -ANALYSIS_LIMITS.historyYears), max: today };
}

export type AnalysisDateError = 'future' | 'tooOld' | 'invalid';

/** Blad daty dla formularza; null = data w zakresie. */
export function validateAnalysisDate(date: string, today: IsoDate): AnalysisDateError | null {
  if (!isoDateSchema.safeParse(date).success) return 'invalid';
  const { min, max } = analysisDateBounds(today);

  if (date > max) return 'future';

  return date < min ? 'tooOld' : null;
}

/** Zadanie analizy z parametrow adresu; null = czegos brakuje (raport pokazuje wtedy powrot do formularza). */
export function analysisRequestFromSearch(search: AnalysisSearch): AnalysisRequest | null {
  const parcelIds = parseParcelSelection(search.dzialki);

  if (parcelIds.length === 0 || !search.uprawa || !search.data) return null;

  return { field: { parcelIds }, cropId: search.uprawa, date: search.data };
}

/** Parametry adresu raportu dla zadania (te same nazwy co w `analysisSearchSchema`). */
export function analysisSearchOf(request: {
  parcelIds: readonly string[];
  cropId: AnalysisRequest['cropId'];
  date: IsoDate;
}): AnalysisSearch {
  return { dzialki: serializeParcelSelection(request.parcelIds), uprawa: request.cropId, data: request.date };
}
