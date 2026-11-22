// Zdjecia Sentinel-2 do raportu (report.vegetationSeries): sceny z okna biezacego (ostatnie 30 dni), ktore API
// statystyk juz zwraca - uzyte i odrzucone przez chmury, pokazane wprost - oraz typowy zakres NDVI/NDMI o tej porze
// z lat poprzednich (po jednej scenie na rok). Archiwum L2A jest od 2017 r.; dla wczesniejszych dat pola nie ma.
import type { VegetationSeriesReport } from '@app/contracts';

import type { VegetationObservation, VegetationSeries } from '../analysis-ports';
import { addDays, yearOf } from '../iso-date';
import { median } from '../water-now';

export const FIRST_ARCHIVE_YEAR = 2017;
/** okno biezace zdjec, gdy zrodlo go nie podalo (raport z pamieci odpowiedzi starszego adaptera) */
const DEFAULT_WINDOW_DAYS = 30;

function range(values: readonly number[]): { min: number; median: number; max: number } | undefined {
  const middle = median(values);

  if (middle === null) return undefined;

  return { min: Math.min(...values), median: Number(middle.toFixed(3)), max: Math.max(...values) };
}

const numbers = (observations: readonly VegetationObservation[], key: 'ndvi' | 'ndmi'): number[] =>
  observations.flatMap((observation) => {
    const value = observation[key];

    return value === null ? [] : [value];
  });

export function vegetationSeriesReport(
  series: VegetationSeries | null,
  date: string,
): VegetationSeriesReport | null {
  if (!series || yearOf(date) < FIRST_ARCHIVE_YEAR) return null;

  const observations = [
    ...series.observations.map((observation) => ({ observation, used: true })),
    ...(series.rejected ?? []).map((observation) => ({ observation, used: false })),
  ]
    .filter(({ observation }) => observation.date <= date)
    .toSorted((a, b) => a.observation.date.localeCompare(b.observation.date))
    .map(({ observation, used }) => ({
      date: observation.date,
      ndvi: observation.ndvi,
      ndmi: observation.ndmi,
      validShare: observation.validShare,
      used,
    }));
  const ndvi = range(numbers(series.baseline, 'ndvi'));
  const ndmi = range(numbers(series.baseline, 'ndmi'));

  if (observations.length === 0 && series.baseline.length === 0) return null;

  return {
    from: series.window?.from ?? addDays(date, -(DEFAULT_WINDOW_DAYS - 1)),
    to: series.window?.to ?? date,
    observations,
    ...(series.baseline.length > 0
      ? {
          baseline: {
            years: series.baseline.length,
            ...(ndvi ? { ndvi } : {}),
            ...(ndmi ? { ndmi } : {}),
          },
        }
      : {}),
  };
}
