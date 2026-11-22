// Ostatnie dni bilansu strefy korzeniowej, dzien po dniu (report.dailySeries) - do wykresu "deszcz i zuzycie":
// opad ze zrodla (luka = brak pola), potrzeby uprawy Kc ET0, zuzycie po stresie i procent wody dostepnej.
import type { WaterReport } from '@app/contracts';

import type { RootZoneDay } from '../root-zone-balance';
import { availablePctOf } from '../water-now';

export const DAILY_SERIES_DAYS = 60;

const round = (value: number): number => Number(value.toFixed(1));

export function dailyWaterSeries(
  days: readonly RootZoneDay[],
  date: string,
  length = DAILY_SERIES_DAYS,
): NonNullable<WaterReport['dailySeries']> {
  return days
    .filter((day) => day.date <= date)
    .slice(-length)
    .map((day) => {
      const point: NonNullable<WaterReport['dailySeries']>[number] = {
        date: day.date,
        etcMm: round(day.potentialEtcMm),
        etaMm: round(day.depletionMm - day.startDepletionMm),
        availablePct: availablePctOf(day),
      };

      if (day.precipMm !== null) point.precipitationMm = round(Math.max(day.precipMm, 0));

      return point;
    });
}
