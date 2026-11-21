// Historia 10 sezonow przed data analizy (etap `history`) liczona tym samym algorytmem co ocena: KBW kazdego z 14
// okresow IUNG wzgledem progu dla uprawy i gleby (kalendarz ryzyka rok x okres) oraz bilans strefy korzeniowej
// (dni stresu i niedobor wody w sezonie). Jeden glos na sezon: "prog przekroczony w 4 z 9 sezonow z danymi".
// Uprawy bez progow IUNG (uzytki zielone) maja miesiace ryzyka z bilansu strefy korzeniowej.
import type { History } from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import { isoDate, monthOf, yearOf } from '../iso-date';
import { iungPeriods } from '../iung-periods';
import { seasonStress, type RootZoneDay } from '../root-zone-balance';
import { assessPeriod, FALLBACK_SOIL_CATEGORY, rootZoneSimulation } from '../water-indicators';

const HISTORY_YEARS = 10;
/** miesiac ryzyka: niedobor wracal w nim prawie tak czesto jak w najgorszym miesiacu */
const RISK_MONTH_SHARE = 0.7;
/** miesiac ze stresem w strefie korzeni: co najmniej tyle dni z Ks < 1 */
const STRESS_DAYS_IN_MONTH = 10;

const round = (value: number): number => Number(value.toFixed(1));

function riskMonths(counts: Map<number, number>): number[] {
  const most = Math.max(0, ...counts.values());

  return [...counts.entries()]
    .filter(([, count]) => most > 0 && count >= most * RISK_MONTH_SHARE)
    .map(([month]) => month)
    .toSorted((a, b) => a - b);
}

/** Miesiace, w ktorych bilans strefy korzeniowej mial co najmniej 10 dni stresu - liczone raz na sezon. */
function stressMonths(days: readonly RootZoneDay[], years: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();

  for (const year of years) {
    const perMonth = new Map<number, number>();

    for (const day of days) {
      if (yearOf(day.date) !== year || day.kc === null || day.stressCoefficient >= 1) continue;

      perMonth.set(monthOf(day.date), (perMonth.get(monthOf(day.date)) ?? 0) + 1);
    }

    for (const [month, stressDays] of perMonth) {
      if (stressDays >= STRESS_DAYS_IN_MONTH) counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  }

  return counts;
}

export function history(input: StageInput): History {
  const group = input.crop.iungGroup;
  const category = input.soil?.category ?? FALLBACK_SOIL_CATEGORY;
  const years = Array.from(
    { length: HISTORY_YEARS },
    (_unused, index) => yearOf(input.date) - HISTORY_YEARS + index,
  );
  const simulation = rootZoneSimulation(input);
  const calendar: History['calendar'] = [];
  const seasons: History['seasons'] = [];
  const droughtByMonth = new Map<number, number>();

  for (const year of years) {
    const periods = iungPeriods(year).map((period) =>
      Object.assign({ period }, assessPeriod(input, period, group, category)),
    );
    const monitored = periods.filter((item) => item.verdict === 'drought' || item.verdict === 'ok');
    const known = periods.flatMap((item) =>
      item.balance.balanceMm === null ? [] : [item.balance.balanceMm],
    );
    const judged = monitored.flatMap((item) =>
      item.balance.balanceMm === null ? [] : [item.balance.balanceMm],
    );
    const stress = simulation
      ? seasonStress(simulation.days, isoDate(year, 1, 1), isoDate(year, 12, 31))
      : null;
    const months = new Set<number>();

    for (const item of periods) {
      calendar.push({
        year,
        periodNo: item.period.no,
        status: item.verdict === 'not_grown' ? 'not_monitored' : item.verdict,
        balanceMm: item.balance.balanceMm,
      });

      if (item.verdict === 'drought') months.add(monthOf(item.period.to));
    }

    // jeden glos na sezon i miesiac - dlugi epizod suszy obejmujacy kilka okresow nie liczy sie wielokrotnie
    for (const month of months) droughtByMonth.set(month, (droughtByMonth.get(month) ?? 0) + 1);

    const withStress = stress !== null && stress.seasonDays > 0;

    seasons.push({
      year,
      droughtPeriods: periods.filter((item) => item.verdict === 'drought').length,
      monitoredPeriods: monitored.length,
      minBalanceMm: judged.length > 0 ? Math.min(...judged) : known.length > 0 ? Math.min(...known) : null,
      stressDays: withStress ? stress.stressDays : null,
      etDeficitMm: withStress ? round(stress.etDeficitMm) : null,
    });
  }

  const withData = seasons.filter((season) => season.minBalanceMm !== null);
  const monitoredCrop = seasons.some((season) => season.monitoredPeriods > 0);

  return {
    seasonsWithData: withData.length,
    droughtSeasons: withData.filter((season) => season.droughtPeriods > 0).length,
    seasons,
    calendar,
    riskMonths: riskMonths(
      monitoredCrop || !simulation ? droughtByMonth : stressMonths(simulation.days, years),
    ),
  };
}
