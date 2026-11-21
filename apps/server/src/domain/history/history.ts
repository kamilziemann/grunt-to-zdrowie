// Historia 10 sezonow przed data analizy (etap `history`) liczona tym samym algorytmem co ocena: KBW kazdego z 14
// okresow IUNG wzgledem progu dla uprawy i gleby (kalendarz ryzyka rok x okres) oraz bilans strefy korzeniowej
// (dni stresu i niedobor wody w sezonie). Jeden glos na sezon: "prog przekroczony w 4 z 9 sezonow z danymi".
// Uprawy bez progow IUNG (uzytki zielone) maja miesiace ryzyka z bilansu strefy korzeniowej.
import type { History } from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import { isoDate, monthOf, yearOf } from '../iso-date';
import { iungPeriods } from '../iung-periods';
import { seasonStress, type RootZoneDay } from '../root-zone-balance';
import {
  assessPeriod,
  EXCESS_BALANCE_MM,
  FALLBACK_SOIL_CATEGORY,
  rootZoneSimulation,
  type PeriodAssessment,
} from '../water-indicators';

const HISTORY_YEARS = 10;
/** miesiac ryzyka: niedobor wracal w nim prawie tak czesto jak w najgorszym miesiacu */
const RISK_MONTH_SHARE = 0.7;
/** miesiac ze stresem w strefie korzeni: co najmniej tyle dni z Ks < 1 */
const STRESS_DAYS_IN_MONTH = 10;

/** sezon z niedoborem wg bilansu strefy korzeniowej: uprawie zabraklo co najmniej tyle wody (mm) */
export const SEASON_DEFICIT_MM = 50;

const round = (value: number): number => Number(value.toFixed(1));

/**
 * Sezony z niedoborem: prog suszy IUNG przekroczony w ktoryms okresie albo uprawie zabraklo co najmniej 50 mm wody
 * wg bilansu strefy korzeniowej (na lekkiej glebie bilans pokazuje niedobor, zanim KBW przekroczy prog kategorii).
 */
export function deficitSeasons(record: Pick<History, 'seasons'> | undefined): {
  deficit: number;
  withData: number;
} {
  const seasons = (record?.seasons ?? []).filter(
    (season) => season.minBalanceMm !== null || (season.etDeficitMm ?? null) !== null,
  );

  return {
    deficit: seasons.filter(
      (season) => season.droughtPeriods > 0 || (season.etDeficitMm ?? 0) >= SEASON_DEFICIT_MM,
    ).length,
    withData: seasons.length,
  };
}

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

type CalendarCell = History['calendar'][number];

function calendarCell(year: number, periodNo: number, item: PeriodAssessment): CalendarCell {
  const balance = item.balance.balanceMm;

  return {
    year,
    periodNo,
    status: item.verdict === 'not_grown' ? 'not_monitored' : item.verdict,
    balanceMm: balance,
    ...(balance !== null && balance > EXCESS_BALANCE_MM ? { excess: true } : {}),
  };
}

/** Okresy roku analizy zakonczone najpozniej w dniu analizy (kalendarz biezacego sezonu). */
function currentCalendar(
  input: StageInput,
  category: NonNullable<StageInput['soil']>['category'],
): CalendarCell[] {
  const year = yearOf(input.date);

  return iungPeriods(year)
    .filter((period) => period.to <= input.date)
    .map((period) =>
      calendarCell(
        year,
        period.no,
        assessPeriod(input, period, input.crop.iungGroup, category ?? FALLBACK_SOIL_CATEGORY),
      ),
    );
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
      calendar.push(calendarCell(year, item.period.no, item));

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
    deficitSeasons: deficitSeasons({ seasons }).deficit,
    seasons,
    calendar,
    currentCalendar: currentCalendar(input, category),
    riskMonths: riskMonths(
      monitoredCrop || !simulation ? droughtByMonth : stressMonths(simulation.days, years),
    ),
  };
}
