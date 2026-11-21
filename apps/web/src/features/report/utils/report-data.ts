// Czyste wyliczenia na raporcie wodnym dla ekranu i wydruku: kolejnosc zalecen i przyczyn, zapas wody w liczbach dla
// rolnika (procent, litry na m2), objetosc dawki na cale pole, siatka kalendarza i znacznik danych przykladowych.
// Raport niesie liczby i identyfikatory, zdania sklada warstwa komponentow z tlumaczen.
import {
  REPORT_PARTS,
  type Cause,
  type ClimaticBalance,
  type History,
  type Recommendation,
  type ReportPart,
  type RootZone,
  type SourceRef,
  type WaterReport,
  type Zone,
} from '@app/contracts';

import { APP_TIME_ZONE } from '@/lib/locale';

/** Zrodla z danymi przykladowymi (atrapy) - raport musi je nazwac. */
export function sampleSources(report: WaterReport): SourceRef[] {
  return report.sources.filter((source) => source.sample);
}

/** Raport (albo ktores zrodlo) z danych przykladowych. */
export function isSampleReport(report: WaterReport): boolean {
  return report.meta.sample || report.sources.some((source) => source.sample);
}

/**
 * Czesci raportu liczone jeszcze przykladowymi regulami. Silnik bez `sampleParts` przy `meta.sample` = caly raport
 * przykladowy (tak mowi kontrakt); raport bez atrap = zadna czesc.
 */
export function sampleParts(report: WaterReport): ReadonlySet<ReportPart> {
  if (report.meta.sampleParts) return new Set(report.meta.sampleParts);

  return new Set(report.meta.sample ? REPORT_PARTS : []);
}

/**
 * Ogolny baner na gorze raportu: gdy ktores zrodlo to atrapa albo silnik nie mowi, ktore czesci sa przykladowe.
 * Gdy zrodla sa juz prawdziwe, a przykladowe sa tylko reguly czesci raportu, wystarcza oznaczenie tych czesci.
 */
export function needsSampleBanner(report: WaterReport): boolean {
  return (
    report.sources.some((source) => source.sample) ||
    (report.meta.sample && report.meta.sampleParts === undefined)
  );
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
  /** komorki okresow 1..14; null = silnik nie podal okresu (w biezacym roku: okres poza raportem) */
  cells: (CalendarCell | null)[];
  /** rok analizy - znamy tylko okres konczacy sie w dniu analizy */
  current: boolean;
}

/** Liczba okresow IUNG w sezonie (21 marca - 30 wrzesnia, co 10 dni po 60 dni). */
export const IUNG_PERIODS = 14;

/** Koniec okresu IUNG 1-14 [miesiac, dzien]: okresy koncza sie co dekade od 20 maja do 30 wrzesnia. */
export const PERIOD_ENDS: readonly (readonly [number, number])[] = [
  [5, 20],
  [5, 31],
  [6, 10],
  [6, 20],
  [6, 30],
  [7, 10],
  [7, 20],
  [7, 31],
  [8, 10],
  [8, 20],
  [8, 31],
  [9, 10],
  [9, 20],
  [9, 30],
];

/** Kolumny kalendarza zgrupowane po miesiacu konca okresu (naglowek "maj | czerwiec | ..."). */
export function periodMonths(): { month: number; periods: number[] }[] {
  const groups: { month: number; periods: number[] }[] = [];

  PERIOD_ENDS.forEach(([month], index) => {
    const last = groups.at(-1);

    if (last?.month === month) last.periods.push(index + 1);
    else groups.push({ month, periods: [index + 1] });
  });

  return groups;
}

/** Okres biezacego roku z oceny (KBW na dzien analizy); null = poza sezonem albo brak bilansu. */
export function currentPeriod(report: WaterReport): CalendarCell | null {
  const balance = report.assessment.climaticBalance;

  if (!balance || balance.periodNo === null) return null;
  const status: CalendarCell['status'] =
    balance.status === 'missing' || balance.balanceMm === null
      ? 'missing'
      : balance.belowThreshold === null
        ? 'not_monitored'
        : balance.belowThreshold
          ? 'drought'
          : 'ok';

  return {
    year: Number(report.meta.analysisDate.slice(0, 4)),
    periodNo: balance.periodNo,
    status,
    balanceMm: balance.balanceMm,
  };
}

/**
 * Kalendarz ryzyka jako wiersze lat (rosnaco) i kolumny okresow 1-14; rok analizy (gdy nie ma go w historii)
 * dopisany na koncu z jedynym znanym okresem.
 */
export function calendarRows(
  calendar: History['calendar'],
  current: CalendarCell | null = null,
): CalendarRow[] {
  const years = [...new Set(calendar.map((cell) => cell.year))].toSorted((a, b) => a - b);
  const rows = years.map((year) => ({
    year,
    cells: Array.from(
      { length: IUNG_PERIODS },
      (_, index) => calendar.find((cell) => cell.year === year && cell.periodNo === index + 1) ?? null,
    ),
    current: false,
  }));

  if (!current || years.includes(current.year)) return rows;

  return [
    ...rows,
    {
      year: current.year,
      cells: Array.from({ length: IUNG_PERIODS }, (_, index) =>
        index + 1 === current.periodNo ? current : null,
      ),
      current: true,
    },
  ];
}

/** Ile lat (z historii) mialo susze w danym okresie - "w tym okresie susza w 3 z 10 lat". */
export function periodDroughtCount(
  calendar: History['calendar'],
  periodNo: number,
): { drought: number; years: number } {
  const cells = calendar.filter(
    (cell) => cell.periodNo === periodNo && (cell.status === 'drought' || cell.status === 'ok'),
  );

  return { drought: cells.filter((cell) => cell.status === 'drought').length, years: cells.length };
}

/** Strefa, ktorej dotyczy zalecenie (null = cale pole, brak mapy stref albo strefa obejmujaca prawie cale pole). */
export function zoneOf(report: WaterReport, zoneId: string | null): Zone | null {
  if (!zoneId) return null;
  const zone = report.zones?.zones.find((item) => item.id === zoneId) ?? null;

  // jedna strefa "typowa" na cala dzialke to nie jest "czesc pola"
  if (zone && zone.areaHa >= report.field.areaHa * 0.95) return null;

  return zone;
}

/** Dzien w Polsce (RRRR-MM-DD) dla chwili ISO. */
function polishDay(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: APP_TIME_ZONE }).format(new Date(iso));
}

/** Analiza dnia z przeszlosci (raport policzony pozniej niz dzien analizy) - zalecenia w czasie przeszlym. */
export function isPastAnalysis(report: WaterReport): boolean {
  return report.meta.analysisDate < polishDay(report.meta.generatedAt);
}

export interface SeasonRow {
  year: number;
  /** dni ze stresem wodnym w sezonie (biezacy: do dnia analizy); null = brak danych */
  stressDays: number | null;
  etDeficitMm: number | null;
  droughtPeriods: number;
  monitoredPeriods: number;
  /** biezacy sezon - liczony tylko do dnia analizy */
  current: boolean;
}

/**
 * Sezony do porownania "ten rok na tle poprzednich": poprzednie z historii i biezacy z bilansu strefy korzeniowej
 * (dni stresu i niedobor od poczatku sezonu do dnia analizy). Biezacy dopisujemy tylko od 21 marca (przed startem
 * sezonu nie ma czego porownywac) i gdy silnik podal podsumowanie sezonu.
 */
export function seasonRows(report: WaterReport): SeasonRow[] {
  const previous = report.history.seasons
    .toSorted((a, b) => a.year - b.year)
    .map((season): SeasonRow => ({
      year: season.year,
      stressDays: season.stressDays,
      etDeficitMm: season.etDeficitMm ?? null,
      droughtPeriods: season.droughtPeriods,
      monitoredPeriods: season.monitoredPeriods,
      current: false,
    }));
  const rootZone = report.assessment.rootZone;
  const date = report.meta.analysisDate;
  const year = Number(date.slice(0, 4));

  if (
    rootZone?.seasonStressDays === undefined ||
    date.slice(5) < '03-21' ||
    previous.some((season) => season.year === year)
  ) {
    return previous;
  }

  const balance = report.assessment.climaticBalance;

  return [
    ...previous,
    {
      year,
      stressDays: rootZone.seasonStressDays,
      etDeficitMm: rootZone.seasonEtDeficitMm ?? null,
      droughtPeriods: balance?.belowThreshold ? 1 : 0,
      monitoredPeriods: balance?.thresholdMm === null || balance === null ? 0 : 1,
      current: true,
    },
  ];
}

/** Srednia i maksimum dni stresu w poprzednich sezonach (bez biezacego); null = brak danych. */
export function stressSummary(
  rows: readonly SeasonRow[],
): { average: number; max: number; maxYear: number } | null {
  const known = rows.filter(
    (row): row is SeasonRow & { stressDays: number } => !row.current && row.stressDays !== null,
  );

  if (known.length === 0) return null;
  const top = known.reduce((best, row) => (row.stressDays > best.stressDays ? row : best));

  return {
    average: Math.round(known.reduce((sum, row) => sum + row.stressDays, 0) / known.length),
    max: top.stressDays,
    maxYear: top.year,
  };
}

export type ScenarioSummary = 'all' | 'none' | 'lighter' | 'mixed';

/**
 * Czy kategoria gleby zmienia diagnoze: susza na kazdej glebie, na zadnej, tylko na lzejszych (I..k) albo w innym
 * ukladzie. Kategorie bez progu (uprawa nieoceniana) pomijamy; null = brak scenariuszy.
 */
export function scenarioSummary(
  balance: ClimaticBalance | null,
): { kind: ScenarioSummary; drought: number[]; ok: number[] } | null {
  const scenarios = (balance?.categoryScenarios ?? []).filter((item) => item.belowThreshold !== null);

  if (scenarios.length === 0) return null;
  const drought = scenarios.filter((item) => item.belowThreshold).map((item) => item.soilCategory);
  const ok = scenarios.filter((item) => !item.belowThreshold).map((item) => item.soilCategory);

  if (ok.length === 0) return { kind: 'all', drought, ok };

  if (drought.length === 0) return { kind: 'none', drought, ok };
  const lighter = Math.max(...drought) < Math.min(...ok);

  return { kind: lighter ? 'lighter' : 'mixed', drought, ok };
}

/** Dzien RRRR-MM-DD jako Date w poludnie UTC - formatowany w dowolnej strefie daje ten sam dzien. */
export function isoDay(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
