// Czyste wyliczenia na raporcie wodnym dla ekranu i wydruku: kolejnosc zalecen i przyczyn, zapas wody w liczbach dla
// rolnika (procent, litry na m2), objetosc dawki na cale pole, siatka kalendarza i znacznik danych przykladowych.
// Raport niesie liczby i identyfikatory, zdania sklada warstwa komponentow z tlumaczen.
import {
  REPORT_PARTS,
  serializeParcelSelection,
  type Cause,
  type ClimaticBalance,
  type History,
  type LimitationId,
  type Recommendation,
  type ReportPart,
  type RootZone,
  type SourceRef,
  type WaterReport,
  type Zone,
} from '@app/contracts';

import { encodeRing, outerRing } from '@/lib/field-geometry';
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

/**
 * Jak szeroko siegaja dane przykladowe: `all` = caly raport (silnik nie mowi, ktore czesci, wszystkie zrodla albo
 * pogoda sa atrapa - na pogodzie stoi cala ocena), `some` = jedno czy dwa zrodla, reszta prawdziwa; null = baner
 * niepotrzebny.
 */
export function sampleScope(report: WaterReport): 'all' | 'some' | null {
  if (!needsSampleBanner(report)) return null;
  const samples = sampleSources(report);

  if (report.meta.sample && report.meta.sampleParts === undefined) return 'all';

  if (samples.length === report.sources.length || samples.some((source) => source.id === 'meteo'))
    return 'all';

  return 'some';
}

/** Ograniczenia, ktore tlumacza niska pewnosc oceny (braki i szacunki) - w kolejnosci wagi. */
const CAVEAT_LIMITATIONS = [
  'meteo_missing',
  'soil_missing',
  'soil_estimated',
  'hydro_missing',
  'vegetation_missing',
  'terrain_missing',
  'meteo_coarse_grid',
  'balance_estimated',
] as const satisfies readonly LimitationId[];

export type CaveatReason = (typeof CAVEAT_LIMITATIONS)[number] | 'meteo_partial';

/**
 * Zastrzezenie przy werdykcie: przy niskiej pewnosci "Woda w normie" nie moze brzmiec uspokajajaco. Zwraca powody
 * (braki danych i szacunki) albo null, gdy pewnosc nie jest niska albo poziomu nie oceniano (poza sezonem, brak).
 */
export function verdictCaveat(report: WaterReport): { reasons: CaveatReason[] } | null {
  const { level, confidence } = report.assessment;

  if (confidence !== 'low' || level === 'out_of_season' || level === 'unknown') return null;
  const limitations = new Set(report.limitations);
  const reasons: CaveatReason[] = CAVEAT_LIMITATIONS.filter((id) => limitations.has(id));
  const meteo = report.sources.find((source) => source.id === 'meteo');

  if (meteo?.status === 'partial' && !limitations.has('meteo_missing')) reasons.splice(1, 0, 'meteo_partial');

  return { reasons };
}

/** Kategoria gleby IUNG cyframi rzymskimi (I-IV). */
export function romanCategory(category: number): string {
  return ['I', 'II', 'III', 'IV'][category - 1] ?? String(category);
}

/** Dlugosc rowow w polu (m) z dowodow przyczyn albo zalecen - szkic pola podaje te sama liczbe; null = brak miary. */
export function ditchInFieldM(report: WaterReport): number | null {
  const evidence = [...report.causes, ...report.recommendations.retention].flatMap((item) => item.evidence);

  return evidence.find((item) => item.metric === 'ditch_length_in_field_m')?.value ?? null;
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
 * Kalendarz ryzyka jako wiersze lat (rosnaco) i kolumny okresow 1-14. Rok analizy (gdy nie ma go w historii) idzie
 * na koniec: okresy, ktore juz sie skonczyly (`currentYear` = `history.currentCalendar`), i okres z oceny (`current`).
 */
export function calendarRows(
  calendar: History['calendar'],
  current: CalendarCell | null = null,
  currentYear: readonly CalendarCell[] = [],
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
  const year = current?.year ?? currentYear[0]?.year;

  if (year === undefined || years.includes(year)) return rows;

  return [
    ...rows,
    {
      year,
      cells: Array.from(
        { length: IUNG_PERIODS },
        (_, index) =>
          currentYear.find((cell) => cell.periodNo === index + 1) ??
          (current?.periodNo === index + 1 ? current : null),
      ),
      current: true,
    },
  ];
}

/** Sezony (z historii), w ktorych choc jeden okres mial nadmiar wody - "nadmiar w 2 z 10 sezonow". */
export function excessSeasons(calendar: History['calendar']): number {
  return new Set(calendar.filter((cell) => cell.excess).map((cell) => cell.year)).size;
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

/** Miejsce na polu z numerem: ten sam numer na szkicu, na mapie, na liscie miejsc i przy zaleceniach. */
export interface NumberedZone {
  zone: Zone;
  number: number;
}

/**
 * Miejsca na polu warte pokazania: strefy inne niz "pozostala czesc pola" (tlo bez wypelnienia), numerowane od 1
 * w kolejnosci z raportu. Jedna strefa na cale pole (pole jednorodne) to nie jest miejsce.
 */
export function fieldZones(report: WaterReport): NumberedZone[] {
  const zones = report.zones?.zones ?? [];

  return zones
    .filter((zone) => zone.kind !== 'typical' && zone.areaHa < report.field.areaHa * 0.95)
    .map((zone, index) => ({ zone, number: index + 1 }));
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

/**
 * Miejsce okresu na tle lat od strony, ktora lepiej go opisuje: w dolnej polowie "N. najsuchszy", w gornej
 * "N. najbardziej mokry" (11. najsuchszy z 11 lat to najbardziej mokry). Parametry do komunikatow `side`/`wet`.
 */
export function rankSide(rank: number, years: number): { side: 'dry' | 'wet'; rank: number; wet: number } {
  const wet = years - rank + 1;

  return { side: years > 1 && wet < rank ? 'wet' : 'dry', rank, wet };
}

/**
 * Parametry adresu, z ktorych da sie policzyc ten raport od nowa (`/raport?dzialki=…&uprawa=…&data=…`): dzialki,
 * a dla czesci dzialki albo narysowanego pola - obrys w zwartym zapisie.
 */
export function reportSearch(report: WaterReport): {
  dzialki?: string;
  obszar?: string;
  rodzaj?: 'part' | 'drawn';
  uprawa: WaterReport['crop']['cropId'];
  data: string;
} {
  const { field } = report;
  const ring = field.kind === 'part' || field.kind === 'drawn' ? outerRing(field.geometry) : null;

  return {
    dzialki: serializeParcelSelection(field.parcelIds),
    ...(ring && (field.kind === 'part' || field.kind === 'drawn')
      ? { obszar: encodeRing(ring), rodzaj: field.kind }
      : {}),
    uprawa: report.crop.cropId,
    data: report.meta.analysisDate,
  };
}

/** Upal "wyraznie ponad norme": co najmniej tyle dni z 14 i co najmniej dwa razy wiecej niz zwykle. */
const HEAT_MIN_DAYS = 5;

/**
 * Upal w ostatnich 14 dniach wyraznie ponad norme (miary `hot_days_*` przy przyczynach): liczba dni z temperatura
 * maksymalna powyzej 30 C i norma dla 14 dni (odniesienie miary albo norma z 30 dni przeliczona na 14). To tylko
 * wyjasnienie - poziomu oceny nie zmienia. null = brak miar albo upal w normie.
 */
export function heatSpell(report: WaterReport): { days: number; normal: number } | null {
  const evidence = report.causes.flatMap((cause) => cause.evidence);
  const find = (metric: string) => evidence.find((item) => item.metric === metric);
  const days14 = find('hot_days_14d');

  if (!days14) return null;
  const normal30 = find('hot_days_30d_normal')?.value ?? find('hot_days_30d')?.reference;
  const normal = days14.reference ?? (normal30 === undefined ? undefined : (normal30 * 14) / 30);

  if (normal === undefined) return null;
  const days = Math.round(days14.value);

  return days >= HEAT_MIN_DAYS && days >= 2 * normal ? { days, normal: Math.round(normal) } : null;
}

export interface ExcessFacts {
  /** opad z ostatnich dni na tle mediany lat (ocena `precipitation`) */
  rain: { days: number; sumMm: number; medianMm: number; rank: number; years: number } | null;
  /** 60 dni: deszcz, parowanie i to, co zostalo w glebie (bilans klimatyczny) */
  balance: { precipMm: number; evapotranspirationMm: number; balanceMm: number } | null;
  /** zaglebienia bez odplywu na polu i ich laczna pojemnosc (m3, 0 = nieznana) */
  depressions: { count: number; volumeM3: number };
  /** miejsca, gdzie zbiera sie woda */
  collecting: number;
  /** rowy w polu (m) z dowodow; null = brak miary */
  ditchInFieldM: number | null;
  /** przy ktoryms z mokrych miejsc biegnie row */
  ditchNearWetZones: boolean;
}

/**
 * Co raport wie o nadmiarze wody (przyczyn nadmiaru silnik nie podaje): deszcz ponad norme, bilans 60 dni na plusie,
 * zaglebienia bez odplywu i miejsca, gdzie zbiera sie woda, rowy, ktore odprowadzaja nadmiar.
 */
export function excessFacts(report: WaterReport): ExcessFacts {
  const { precipitation, climaticBalance } = report.assessment;
  const wet = fieldZones(report)
    .map((item) => item.zone)
    .filter((zone) => zone.kind === 'depression' || zone.kind === 'collecting');
  const depressions = wet.filter((zone) => zone.kind === 'depression');
  const balance =
    climaticBalance?.balanceMm === null || climaticBalance?.balanceMm === undefined
      ? null
      : { ...climaticBalance, balanceMm: climaticBalance.balanceMm };

  return {
    rain:
      precipitation && precipitation.sumMm > precipitation.medianMm
        ? {
            days: precipitation.days,
            sumMm: precipitation.sumMm,
            medianMm: precipitation.medianMm,
            rank: precipitation.rank,
            years: precipitation.years,
          }
        : null,
    balance:
      balance && balance.precipMm !== null && balance.evapotranspirationMm !== null && balance.balanceMm > 0
        ? {
            precipMm: balance.precipMm,
            evapotranspirationMm: balance.evapotranspirationMm,
            balanceMm: balance.balanceMm,
          }
        : null,
    depressions: {
      count: depressions.length,
      volumeM3: depressions.reduce((sum, zone) => sum + (zone.volumeM3 ?? 0), 0),
    },
    collecting: wet.length - depressions.length,
    ditchInFieldM: ditchInFieldM(report),
    ditchNearWetZones: wet.some((zone) => zone.ditchDistanceM !== undefined),
  };
}
