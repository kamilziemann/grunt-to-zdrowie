// PRZYKLADOWE etapy silnika analizy: proste, jawne rachunki, ktore daja kompletny raport o wlasciwym ksztalcie,
// zanim powstana wlasciwe pakiety (P2 klimatyczny bilans wodny z progami IUNG, P7 bilans strefy korzeniowej,
// P8 ocena i historia, P9 przyczyny i zalecenia, P12 strefy). Progi i reguly ponizej sa UPROSZCZONE i nie sa
// metodyka docelowa - kazdy etap jest podmieniany osobno w container.ts. Okresy liczenia sa juz wlasciwe (IUNG).
import type {
  Assessment,
  AssessmentLevel,
  Cause,
  ClimaticBalance,
  Evidence,
  History,
  LimitationId,
  Recommendation,
  RootZone,
  SoilCategory,
  ZoneMap,
} from '@app/contracts';

import type { MeteoSeries } from '../analysis-ports';
import type { AnalysisStages, Recommendations, StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { cropProfile } from '../crops';
import { addDays, daysBetween, monthOf, withYear, yearOf } from '../iso-date';
import { iungPeriodEndingBy, iungPeriods, type IungPeriod } from '../iung-periods';
import { terrainTooCoarse } from '../terrain';
import { vegetationSignal } from '../vegetation-signal';

/** Uproszczone progi suszy dla kategorii gleby (mm); wlasciwa tabela IUNG zalezy tez od uprawy i okresu (P2). */
const SAMPLE_THRESHOLD_MM: Record<SoilCategory, number> = { 1: -150, 2: -170, 3: -205, 4: -230 };
const DEFAULT_CATEGORY: SoilCategory = 2;
const HISTORY_YEARS = 10;
const WINDOW_DAYS = 60;
const PRECIP_DAYS = 30;
const BALANCE_DAYS = 90;
const NARROW_FIELD_M = 40;
/** profil podluzny ma sens dopiero dla pola wyraznie dluzszego niz szerokie */
const PROFILE_MIN_LENGTH_M = 200;
const CELL_M = 10;
const MIN_WINDOW_COVERAGE = 0.9;

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

type Pick2 = 'precipMm' | 'et0Mm';

/** Suma z dni w oknie; null, gdy dane pokrywaja mniej niz 90% okna (niepelne okno zanizaloby sume). */
function sumBetween(meteo: MeteoSeries, from: string, to: string, pick: Pick2): number | null {
  let sum = 0;
  let count = 0;

  for (const day of meteo.days) {
    const value = day[pick];

    if (day.date < from || day.date > to || value === null) continue;

    sum += value;
    count += 1;
  }

  return count < (daysBetween(from, to) + 1) * MIN_WINDOW_COVERAGE ? null : round(sum);
}

function balanceFor(
  meteo: MeteoSeries,
  period: Pick<IungPeriod, 'from' | 'to'>,
): { precipMm: number | null; evapotranspirationMm: number | null; balanceMm: number | null } {
  const precipMm = sumBetween(meteo, period.from, period.to, 'precipMm');
  const evapotranspirationMm = sumBetween(meteo, period.from, period.to, 'et0Mm');

  return {
    precipMm,
    evapotranspirationMm,
    balanceMm:
      precipMm === null || evapotranspirationMm === null ? null : round(precipMm - evapotranspirationMm),
  };
}

function climaticBalance(input: StageInput): ClimaticBalance | null {
  const { meteo, date, crop, soil } = input;

  if (!meteo) return null;

  const period = iungPeriodEndingBy(date);
  const window = period ?? { from: addDays(date, -(WINDOW_DAYS - 1)), to: date };
  const sums = balanceFor(meteo, window);
  const soilCategory = soil?.category ?? null;
  const monitored = period !== null && crop.iungGroup !== null;
  const thresholdMm = monitored && soilCategory ? SAMPLE_THRESHOLD_MM[soilCategory] : null;

  return {
    status:
      sums.balanceMm === null
        ? 'missing'
        : period === null
          ? 'out_of_season'
          : monitored
            ? 'ok'
            : 'not_monitored',
    periodNo: period?.no ?? null,
    periodFrom: window.from,
    periodTo: window.to,
    ...sums,
    thresholdMm,
    soilCategory,
    belowThreshold: thresholdMm === null || sums.balanceMm === null ? null : sums.balanceMm < thresholdMm,
    method: 'fao56_penman_monteith',
  };
}

/** Uproszczony bilans strefy korzeniowej: stale Kc z daty analizy, start z pelnym zapasem 90 dni wczesniej. */
function rootZone(input: StageInput): RootZone | null {
  const { meteo, soil, crop, date, cropId } = input;

  if (!meteo || !soil || crop.kc === null || crop.rootDepthM === null) return null;

  const total = soil.availableWaterMmPerM * crop.rootDepthM;
  const readily = total * cropProfile(cropId).depletionFraction;
  const from = addDays(date, -(BALANCE_DAYS - 1));
  const stressFrom = addDays(date, -(PRECIP_DAYS - 1));
  let depletion = 0;
  let stressDays = 0;

  for (const day of meteo.days) {
    if (day.date < from || day.date > date) continue;

    depletion = clamp(depletion + crop.kc * (day.et0Mm ?? 0) - (day.precipMm ?? 0), 0, total);

    if (day.date >= stressFrom && depletion > readily) stressDays += 1;
  }

  const stress = depletion <= readily ? 1 : clamp((total - depletion) / (total - readily), 0, 1);

  return {
    totalAvailableMm: round(total),
    readilyAvailableMm: round(readily),
    depletionMm: round(depletion),
    depletionShare: round(clamp(depletion / total, 0, 1), 2),
    stressCoefficient: round(stress, 2),
    stressDays30: stressDays,
  };
}

/** Sygnal satelitarny wzgledem uprawy i fazy - jedna definicja w domain/vegetation-signal (uzywa jej tez ocena). */
export { vegetationSignal };

/** Opad z ostatnich 30 dni na tle tych samych dni w 10 latach poprzednich. */
export function precipitationContext(input: StageInput): Assessment['precipitation'] {
  const { meteo, date } = input;

  if (!meteo) return null;

  const sumFor = (end: string) => sumBetween(meteo, addDays(end, -(PRECIP_DAYS - 1)), end, 'precipMm');
  const current = sumFor(date);
  const earlier = Array.from({ length: HISTORY_YEARS }, (_unused, index) =>
    sumFor(withYear(date, yearOf(date) - 1 - index)),
  ).filter((value): value is number => value !== null);

  if (current === null || earlier.length === 0) return null;

  const sorted = earlier.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;

  return {
    days: PRECIP_DAYS,
    sumMm: current,
    medianMm: round(median),
    rank: earlier.filter((value) => value < current).length + 1,
    years: earlier.length + 1,
  };
}

function levelOf(balance: ClimaticBalance | null, zone: RootZone | null): AssessmentLevel {
  if (!balance || balance.status === 'missing') return 'unknown';

  if (balance.status === 'out_of_season') return 'out_of_season';

  if (balance.belowThreshold === true) return 'drought';

  if (zone && zone.stressCoefficient < 1) return 'risk';

  if ((balance.balanceMm ?? 0) > 60) return 'excess';

  return zone && zone.depletionMm > 0.7 * zone.readilyAvailableMm ? 'watch' : 'ok';
}

function assess(input: StageInput): Assessment {
  const balance = climaticBalance(input);
  const zone = rootZone(input);
  const level = levelOf(balance, zone);
  const deficit = level === 'drought' || level === 'risk';
  const present = [input.meteo, input.soil, input.vegetation].filter((item) => item !== null).length;

  return {
    level,
    // wersja przykladowa nigdy nie deklaruje wysokiej pewnosci
    confidence: present === 3 && level !== 'unknown' ? 'medium' : 'low',
    climaticBalance: balance,
    rootZone: zone,
    vegetation: vegetationSignal(input, deficit),
    precipitation: precipitationContext(input),
  };
}

function history(input: StageInput): History {
  const { meteo, crop, soil, date } = input;
  const threshold = SAMPLE_THRESHOLD_MM[soil?.category ?? DEFAULT_CATEGORY];
  const years = Array.from(
    { length: HISTORY_YEARS },
    (_unused, index) => yearOf(date) - HISTORY_YEARS + index,
  );
  const calendar: History['calendar'] = [];
  const seasons: History['seasons'] = [];

  for (const year of years) {
    const balances = iungPeriods(year).map((period) => ({
      periodNo: period.no,
      month: monthOf(period.to),
      balanceMm: meteo ? balanceFor(meteo, period).balanceMm : null,
    }));
    const known = balances.filter(
      (item): item is typeof item & { balanceMm: number } => item.balanceMm !== null,
    );

    for (const item of balances) {
      calendar.push({
        year,
        periodNo: item.periodNo,
        status:
          item.balanceMm === null
            ? 'missing'
            : crop.iungGroup === null
              ? 'not_monitored'
              : item.balanceMm < threshold
                ? 'drought'
                : 'ok',
        balanceMm: item.balanceMm,
      });
    }

    seasons.push({
      year,
      droughtPeriods: crop.iungGroup === null ? 0 : known.filter((item) => item.balanceMm < threshold).length,
      monitoredPeriods: crop.iungGroup === null ? 0 : known.length,
      minBalanceMm: known.length === 0 ? null : Math.min(...known.map((item) => item.balanceMm)),
      stressDays: null,
    });
  }

  const withData = seasons.filter((season) => season.minBalanceMm !== null);
  const droughtByMonth = new Map<number, number>();

  for (const item of calendar) {
    if (item.status !== 'drought') continue;

    const month = monthOf(iungPeriods(item.year)[item.periodNo - 1]?.to ?? `${item.year}-07-01`);

    droughtByMonth.set(month, (droughtByMonth.get(month) ?? 0) + 1);
  }

  const most = Math.max(0, ...droughtByMonth.values());

  return {
    seasonsWithData: withData.length,
    droughtSeasons: withData.filter((season) => season.droughtPeriods > 0).length,
    seasons,
    calendar,
    // miesiace, w ktorych susza wracala prawie tak czesto jak w najgorszym
    riskMonths: [...droughtByMonth.entries()]
      .filter(([, count]) => most > 0 && count >= most * 0.7)
      .map(([month]) => month)
      .toSorted((a, b) => a - b),
  };
}

function causes(input: StageInput, assessment: Assessment): Cause[] {
  if (!['watch', 'risk', 'drought'].includes(assessment.level)) return [];

  const found: Cause[] = [];
  const { precipitation, climaticBalance: balance } = assessment;
  const { soil, terrain, hydro } = input;

  if (precipitation && precipitation.sumMm < precipitation.medianMm * 0.8) {
    found.push({
      id: 'precipitation_deficit',
      weight: round(clamp(1 - precipitation.sumMm / Math.max(precipitation.medianMm, 1), 0.1, 1), 2),
      evidence: [
        {
          metric: 'precip_30d',
          value: precipitation.sumMm,
          unit: 'mm',
          reference: precipitation.medianMm,
          source: 'meteo',
        },
      ],
    });
  }

  if (balance?.evapotranspirationMm !== null && balance?.evapotranspirationMm !== undefined) {
    const demand = balance.evapotranspirationMm;

    if (demand > 200) {
      found.push({
        id: 'high_evaporative_demand',
        weight: round(clamp((demand - 200) / 100, 0.1, 1), 2),
        evidence: [{ metric: 'et0_period', value: demand, unit: 'mm', reference: 200, source: 'meteo' }],
      });
    }
  }

  if (soil && soil.category !== null && soil.category <= 2) {
    found.push({
      id: 'low_soil_retention',
      weight: soil.category === 1 ? 0.8 : 0.5,
      evidence: [
        {
          metric: 'available_water_mm_per_m',
          value: soil.availableWaterMmPerM,
          unit: 'mm/m',
          reference: 170,
          source: 'soil',
        },
      ],
    });
  }

  if (terrain && terrain.summary.slopeMeanPct >= 3) {
    found.push({
      id: 'surface_runoff',
      weight: round(clamp(terrain.summary.slopeMeanPct / 10, 0.2, 1), 2),
      evidence: [
        {
          metric: 'slope_mean_pct',
          value: terrain.summary.slopeMeanPct,
          unit: '%',
          reference: 3,
          source: 'terrain',
        },
      ],
    });
  }

  if (hydro && hydro.nearestDitchM !== null && hydro.nearestDitchM < 150) {
    found.push({
      id: 'fast_drainage',
      weight: 0.4,
      evidence: [
        { metric: 'nearest_ditch_m', value: hydro.nearestDitchM, unit: 'm', reference: 150, source: 'hydro' },
      ],
    });
  }

  if (hydro && hydro.waterBodies === 0 && hydro.wetlands === 0 && (hydro.treeCoverShare ?? 0) < 0.05) {
    found.push({
      id: 'no_landscape_retention',
      weight: 0.3,
      evidence: [
        {
          metric: 'tree_cover_share',
          value: hydro.treeCoverShare ?? 0,
          unit: 'share',
          reference: 0.05,
          source: 'hydro',
        },
      ],
    });
  }

  return found.toSorted((a, b) => b.weight - a.weight);
}

/** Przyblizona dlugosc dluzszego boku pola w metrach (z prostokata otaczajacego). */
function longSideM(input: StageInput): number {
  const [west, south, east, north] = input.field.bbox;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos(((south + north) / 2) * (Math.PI / 180));

  return Math.max((east - west) * metersPerDegLng, (north - south) * metersPerDegLat, 1);
}

function zones(input: StageInput): ZoneMap | null {
  const { field, terrain, vegetation } = input;

  if (!terrain && !vegetation) return null;

  // dluga i waska dzialka (mniej niz kilka pikseli szerokosci) dostaje profil podluzny zamiast stref
  const length = longSideM(input);
  const narrow = length >= PROFILE_MIN_LENGTH_M && (field.areaHa * 10_000) / length < NARROW_FIELD_M;

  return {
    layout: narrow ? 'profile' : 'zones',
    cellSizeM: CELL_M,
    cells: Math.round((field.areaHa * 10_000) / (CELL_M * CELL_M)),
    // wersja przykladowa: jedna strefa na cale pole (podzial na komorki robi pakiet P12)
    zones: [
      {
        id: 'zone-1',
        kind: narrow ? 'segment' : 'typical',
        areaHa: field.areaHa,
        geometry: field.geometry,
        ...(terrain ? { slopePct: terrain.summary.slopeMeanPct } : {}),
      },
    ],
  };
}

type Measure = Pick<Recommendation, 'measure' | 'category' | 'priority' | 'effect' | 'effort' | 'legal'>;

const MEASURES: Record<Cause['id'], Measure[]> = {
  precipitation_deficit: [
    {
      measure: 'mulch_residue',
      category: 'agrotech',
      priority: 1,
      effect: { kind: 'evaporation_pct', value: 25 },
      effort: 'low',
      legal: 'none',
    },
  ],
  high_evaporative_demand: [
    {
      measure: 'reduced_tillage',
      category: 'agrotech',
      priority: 2,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
  ],
  low_soil_retention: [
    {
      measure: 'organic_matter',
      category: 'agrotech',
      priority: 1,
      effect: { kind: 'water_mm', value: 2 },
      effort: 'medium',
      legal: 'none',
    },
    { measure: 'cover_crop', category: 'agrotech', priority: 2, effect: null, effort: 'low', legal: 'none' },
  ],
  surface_runoff: [
    {
      measure: 'grassed_waterway',
      category: 'retention',
      priority: 1,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
    {
      measure: 'contour_farming',
      category: 'agrotech',
      priority: 2,
      effect: null,
      effort: 'low',
      legal: 'none',
    },
  ],
  fast_drainage: [
    {
      measure: 'ditch_weir',
      category: 'retention',
      priority: 1,
      effect: null,
      effort: 'medium',
      legal: 'notification',
    },
  ],
  no_landscape_retention: [
    {
      measure: 'field_margin_trees',
      category: 'retention',
      priority: 2,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
  ],
  crop_sensitivity: [
    {
      measure: 'crop_choice',
      category: 'agrotech',
      priority: 3,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
  ],
};

function recommend(
  input: StageInput,
  assessment: Assessment,
  found: Cause[],
  zoneMap: ZoneMap | null,
): Recommendations {
  const byMeasure = new Map<string, Recommendation>();

  for (const cause of found) {
    for (const measure of MEASURES[cause.id]) {
      const existing = byMeasure.get(measure.measure);

      if (existing) {
        existing.causes.push(cause.id);
        existing.evidence.push(...cause.evidence);

        continue;
      }

      byMeasure.set(measure.measure, {
        ...measure,
        causes: [cause.id],
        evidence: [...cause.evidence] as [Evidence, ...Evidence[]],
        // dzialania terenowe wskazuja miejsce na polu, agrotechniczne dotycza calego pola
        zoneId: measure.category === 'retention' ? (zoneMap?.zones[0]?.id ?? null) : null,
      });
    }
  }

  const all = [...byMeasure.values()].toSorted((a, b) => a.priority - b.priority);
  const zone = assessment.rootZone;
  const stressed = zone !== null && zone.depletionMm > zone.readilyAvailableMm;
  const forecast = input.forecast?.days ?? [];

  return {
    retention: all.filter((item) => item.category === 'retention'),
    agrotech: all.filter((item) => item.category === 'agrotech'),
    // nawadnianie na koncu i tylko z bilansu: bez bilansu strefy korzeniowej nie ma wskazowki
    irrigation: zone
      ? {
          advisable: !stressed ? 'no' : zone.stressCoefficient < 0.6 ? 'yes' : 'consider',
          netDepthMm: stressed ? Math.round(zone.depletionMm) : null,
          withinDays: stressed && forecast.length > 0 ? 3 : null,
          forecastPrecipMm:
            forecast.length === 0 ? null : round(forecast.reduce((sum, day) => sum + (day.precipMm ?? 0), 0)),
        }
      : null,
  };
}

function limitations(input: StageInput, assessment: Assessment): LimitationId[] {
  const found: LimitationId[] = ['no_in_situ_measurement', 'field_verification_needed'];
  const balance = assessment.climaticBalance;

  if (balance) found.push('balance_estimated');

  if (balance?.status === 'out_of_season') found.push('out_of_season');

  if (balance?.status === 'not_monitored') found.push('crop_not_monitored');

  if (input.meteo && input.meteo.gridKm > 20) found.push('meteo_coarse_grid');

  if (input.soil) found.push('soil_estimated');

  if (assessment.vegetation && assessment.vegetation.pixels < 5) found.push('vegetation_few_pixels');

  // model terenu 30 m na polu mniejszym niz ok. 2 ha - spadek i zaglebienia sa tylko przyblizeniem
  if (input.terrain && terrainTooCoarse(input.field.areaHa)) found.push('terrain_coarse');

  return found;
}

export const sampleStages: AnalysisStages = {
  sampleParts: ['assessment', 'history', 'causes', 'zones', 'recommendations'],
  crop: cropAtDate,
  assess,
  history,
  causes,
  zones,
  recommend,
  limitations,
};
