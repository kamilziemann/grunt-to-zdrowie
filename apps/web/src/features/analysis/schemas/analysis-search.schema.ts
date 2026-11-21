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
  type ParcelGeometry,
} from '@app/contracts';
import { z } from 'zod';

import { decodeRing, isSimpleRing, ringGeometry } from '@/lib/field-geometry';
import { APP_TIME_ZONE } from '@/lib/locale';

/** Dlugosc zapisu obrysu w adresie: 60 punktow po kilka znakow z zapasem. */
const AREA_TEXT_MAX = 1000;

export const analysisSearchSchema = parcelSelectionSearchSchema.extend({
  /** wlasny obszar (D3): obrys w zwartym zapisie; bez niego pole = dzialki z `dzialki` */
  obszar: z.string().max(AREA_TEXT_MAX).optional().catch(undefined),
  rodzaj: z.enum(['part', 'drawn']).optional().catch(undefined),
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

/** Obrys wlasnego obszaru z adresu; null = brak albo zapis uszkodzony (obrys przeciety tez odrzucamy). */
export function fieldAreaFromSearch(search: Pick<AnalysisSearch, 'obszar'>): AnalysisFieldArea | null {
  if (!search.obszar) return null;
  const ring = decodeRing(search.obszar);

  return ring && isSimpleRing(ring) ? { ring, geometry: ringGeometry(ring) } : null;
}

export interface AnalysisFieldArea {
  ring: [number, number][];
  geometry: ParcelGeometry;
}

/** Numer dzialki z identyfikatora (czesc po obrebie): 141201_1.0001.6509 -> 6509. */
export function parcelNumberOf(id: string): string {
  return id.split('.').slice(2).join('.') || id;
}

/**
 * Zadanie analizy z parametrow adresu; null = czegos brakuje (raport pokazuje wtedy powrot do formularza). Wlasny
 * obszar ma pierwszenstwo przed dzialkami: idzie jako geometria z opisem (`areaLabel`), bez identyfikatorow
 * dzialek - schemat API przy niepustej liscie dzialek wybiera wariant "cale dzialki" i pomija geometrie.
 */
export function analysisRequestFromSearch(
  search: AnalysisSearch,
  areaLabel?: (kind: 'part' | 'drawn', parcelNumbers: string[]) => string,
): AnalysisRequest | null {
  const parcelIds = parseParcelSelection(search.dzialki);
  const area = fieldAreaFromSearch(search);

  if (!search.uprawa || !search.data) return null;

  if (search.obszar) {
    if (!area) return null;
    const kind = search.rodzaj ?? 'drawn';
    const label = areaLabel?.(kind, parcelIds.map(parcelNumberOf)).slice(0, ANALYSIS_LIMITS.labelMax);

    return {
      field: { geometry: area.geometry, kind, parcelIds: [], ...(label ? { label } : {}) },
      cropId: search.uprawa,
      date: search.data,
    };
  }

  if (parcelIds.length === 0) return null;

  return { field: { parcelIds }, cropId: search.uprawa, date: search.data };
}

/** Parametry adresu raportu dla zadania (te same nazwy co w `analysisSearchSchema`). */
export function analysisSearchOf(request: {
  parcelIds: readonly string[];
  cropId: AnalysisRequest['cropId'];
  date: IsoDate;
  obszar?: string;
  rodzaj?: 'part' | 'drawn';
}): AnalysisSearch {
  return {
    dzialki: serializeParcelSelection(request.parcelIds),
    obszar: request.obszar,
    rodzaj: request.obszar ? request.rodzaj : undefined,
    uprawa: request.cropId,
    data: request.date,
  };
}
