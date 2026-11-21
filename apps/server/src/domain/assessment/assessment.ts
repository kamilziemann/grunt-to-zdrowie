// Ocena sytuacji wodnej w dacie analizy (etap `assess`): dwa bilanse, jeden werdykt.
// 1. KBW wg IUNG za ostatni pelny okres szesciodekadowy konczacy sie najpozniej w dacie analizy, porownany z progiem
//    suszy dla grupy upraw i kategorii gleby (bez Kc). Gdy kategoria gleby jest nieznana, liczymy wszystkie cztery
//    i mowimy, czy wybor zmienia diagnoze.
// 2. Dobowy bilans strefy korzeniowej FAO-56 (Kc, TAW, RAW, Dr, Ks) - czy uprawa ma teraz stres wodny.
// Poza 21 marca - 30 wrzesnia progi suszy nie obowiazuja: poziom `out_of_season`, a bilans strefy korzeniowej
// pokazuje zapas wody przed sezonem. Miedzy 21 marca a 20 maja nie ma jeszcze pelnego okresu IUNG - KBW liczymy za
// ostatnie 60 dni bez progu, a poziom wynika z bilansu strefy korzeniowej.
// Gleba nieznana: bilans strefy korzeniowej liczymy dla gleby sredniej (jawne zalozenie), a werdykt KBW
// z czterech kategorii. `ok` tylko wtedy, gdy wszystkie scenariusze i bilans mowia "bez niedoboru" - przy rozbieznosci
// poziom ostrzega, nigdy nie uspokaja.
import type { Assessment, AssessmentLevel, ClimaticBalance, RootZone } from '@app/contracts';

import type { SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { confidenceOf, type UncertaintyId } from '../confidence';
import { hasFarmland } from '../land-use';
import { addDays, isoDate, yearOf } from '../iso-date';
import { iungPeriodEndingBy, iungPeriods } from '../iung-periods';
import { seasonStress, type RootZoneDay } from '../root-zone-balance';
import { precipitationContext, vegetationSignal } from '../sample-stages';
import {
  assessPeriod,
  balanceSoil,
  EXCESS_BALANCE_MM,
  rootZoneSimulation,
  SOIL_CATEGORIES,
  type PeriodAssessment,
  FALLBACK_SOIL_CATEGORY,
} from '../water-indicators';

const HISTORY_YEARS = 10;
const WINDOW_DAYS = 60;
const STRESS_WINDOW_DAYS = 30;
/** KBW blizej progu niz o 25% jego wartosci = "obserwuj" */
const WATCH_SHARE_OF_THRESHOLD = 0.75;
/** wyczerpanie powyzej 80% RAW = zapas latwo dostepnej wody na wyczerpaniu */
const WATCH_SHARE_OF_RAW = 0.8;
const COARSE_GRID_KM = 20;

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

export function inGrowingSeason(date: string): boolean {
  const year = yearOf(date);

  return date >= isoDate(year, 3, 21) && date <= isoDate(year, 9, 30);
}

function climaticBalance(input: StageInput): ClimaticBalance | null {
  const { meteo, date, crop, soil } = input;

  if (!meteo) return null;

  const period = iungPeriodEndingBy(date);
  const window = period ?? { no: 0, from: addDays(date, -(WINDOW_DAYS - 1)), to: date };
  const scenarios = SOIL_CATEGORIES.map((category) => ({
    category,
    result: assessPeriod(input, window, period ? crop.iungGroup : null, category),
  }));
  const category = soil?.category ?? null;
  const chosen = scenarios.find((scenario) => scenario.category === category)?.result;
  const { balance } = scenarios[0]?.result ?? assessPeriod(input, window, null, 1);
  const judged = scenarios.filter(({ result }) => result.thresholdMm !== null);
  const verdicts = new Set(judged.map(({ result }) => result.verdict));
  // bez kategorii gleby werdykt jest pewny tylko wtedy, gdy wszystkie kategorie mowia to samo
  const agreed =
    judged.length === SOIL_CATEGORIES.length && verdicts.size === 1 ? judged[0]?.result : undefined;
  const decisive: PeriodAssessment | undefined = chosen ?? agreed;
  const monitored = judged.length > 0;
  const history =
    period && balance.balanceMm !== null ? rankInHistory(input, period, balance.balanceMm) : null;

  return {
    status:
      balance.balanceMm === null
        ? 'missing'
        : period === null
          ? 'out_of_season'
          : monitored
            ? 'ok'
            : 'not_monitored',
    periodNo: period?.no ?? null,
    periodFrom: window.from,
    periodTo: window.to,
    precipMm: balance.precipMm,
    evapotranspirationMm: balance.evapotranspirationMm,
    balanceMm: balance.balanceMm,
    thresholdMm: chosen?.thresholdMm ?? null,
    soilCategory: category,
    belowThreshold: decisive && decisive.thresholdMm !== null ? decisive.verdict === 'drought' : null,
    method: 'iung_dg95',
    coverage: balance.coverage,
    ...(period && monitored
      ? {
          categoryScenarios: scenarios.map(({ category: soilCategory, result }) => ({
            soilCategory,
            thresholdMm: result.thresholdMm,
            belowThreshold: result.thresholdMm === null ? null : result.verdict === 'drought',
          })),
        }
      : {}),
    ...(history ? { rankInHistory: history } : {}),
  };
}

/** Miejsce KBW tego okresu wsrod tych samych okresow z 10 lat poprzednich (1 = najsuchszy). */
function rankInHistory(
  input: StageInput,
  period: { no: number },
  balanceMm: number,
): { rank: number; years: number } | null {
  const earlier = Array.from({ length: HISTORY_YEARS }, (_unused, index) => yearOf(input.date) - 1 - index)
    .map((year) => iungPeriods(year)[period.no - 1])
    .flatMap((past) => (past ? [assessPeriod(input, past, null, 1).balance.balanceMm] : []))
    .filter((value): value is number => value !== null);

  if (earlier.length === 0) return null;

  return { rank: earlier.filter((value) => value < balanceMm).length + 1, years: earlier.length + 1 };
}

function rootZone(input: StageInput): { zone: RootZone; today: RootZoneDay } | null {
  const simulation = rootZoneSimulation(input);
  const today = simulation?.days.at(-1);

  if (!simulation || !today) return null;

  const recentFrom = addDays(input.date, -(STRESS_WINDOW_DAYS - 1));
  const recent = seasonStress(simulation.days, recentFrom, input.date);
  const season = seasonStress(simulation.days, isoDate(yearOf(input.date), 1, 1), input.date);

  return {
    today,
    zone: {
      totalAvailableMm: round(today.totalAvailableMm),
      readilyAvailableMm: round(today.readilyAvailableMm),
      depletionMm: round(today.depletionMm),
      depletionShare:
        today.totalAvailableMm > 0
          ? round(Math.min(Math.max(today.depletionMm / today.totalAvailableMm, 0), 1), 2)
          : 1,
      stressCoefficient: round(today.stressCoefficient, 2),
      stressDays30: recent.stressDays,
      seasonStressDays: season.stressDays,
      seasonEtDeficitMm: round(season.etDeficitMm),
    },
  };
}

interface Signals {
  balance: ClimaticBalance | null;
  zone: RootZone | null;
  /** uprawa rosnie w dacie analizy (Kc z krzywej) - tylko wtedy stres korzeni jest diagnoza */
  growing: boolean;
}

/** Werdykt KBW nierozstrzygniety (gleba nieznana), a na czesci kategorii gleby prog jest przekroczony. */
export function scenariosDisagree(balance: ClimaticBalance | null): boolean {
  if (!balance || balance.belowThreshold !== null) return false;

  const verdicts = (balance.categoryScenarios ?? []).map((scenario) => scenario.belowThreshold);

  return verdicts.includes(true);
}

function verdictBasis(balance: ClimaticBalance | null): Assessment['verdictBasis'] {
  const judged = (balance?.categoryScenarios ?? []).some((scenario) => scenario.belowThreshold !== null);

  if (!balance || !judged) return undefined;

  if (balance.soilCategory !== null && balance.thresholdMm !== null) return 'soil_category';

  return scenariosDisagree(balance) ? 'scenarios_disagree' : 'scenarios_agree';
}

export function levelOf(date: string, { balance, zone, growing }: Signals): AssessmentLevel {
  if (!balance && !zone) return 'unknown';

  if (!inGrowingSeason(date)) return 'out_of_season';

  if (balance?.belowThreshold === true) return 'drought';

  const stressed = growing && zone !== null && zone.stressCoefficient < 1;

  if (stressed) return 'risk';

  const nearThreshold =
    balance?.balanceMm !== null &&
    balance?.balanceMm !== undefined &&
    balance.thresholdMm !== null &&
    balance.balanceMm < balance.thresholdMm * WATCH_SHARE_OF_THRESHOLD;
  const drying = growing && zone !== null && zone.depletionMm > zone.readilyAvailableMm * WATCH_SHARE_OF_RAW;

  // gleba nieznana, a na lzejszych glebach susza: nie wiemy, czy to pole jest bezpieczne - ostrzegamy
  if (nearThreshold || drying || scenariosDisagree(balance)) return 'watch';

  const wet = (balance?.balanceMm ?? 0) > EXCESS_BALANCE_MM && (zone === null || zone.depletionShare < 0.05);

  return wet ? 'excess' : 'ok';
}

/**
 * Czy werdykt KBW zmienilby sie przy innej prawdopodobnej kategorii gleby: z zakresu profilu (uziarnienie vs woda
 * w profilu) poszerzonego o kategorie sasiednie - model 250 m myli sie zwykle o jedna kategorie.
 */
function verdictDependsOnCategory(soil: SoilProfile, balance: ClimaticBalance | null): boolean {
  const scenarios = balance?.categoryScenarios ?? [];
  const category = soil.category ?? FALLBACK_SOIL_CATEGORY;
  const [low, high] = soil.categoryRange ?? [category, category];
  const verdicts = new Set(
    scenarios
      .filter(
        (scenario) =>
          scenario.soilCategory >= Math.min(low, category - 1) &&
          scenario.soilCategory <= Math.max(high, category + 1) &&
          scenario.belowThreshold !== null,
      )
      .map((scenario) => scenario.belowThreshold),
  );

  return verdicts.size > 1;
}

/** Sprzeczne sygnaly: KBW mowi "susza", a w strefie korzeni wody nie brakuje - albo odwrotnie. */
function conflicting({ balance, zone, growing }: Signals): boolean {
  if (!balance || !zone || !growing || balance.belowThreshold === null) return false;

  if (balance.belowThreshold) return zone.depletionMm < zone.readilyAvailableMm * 0.5;

  return zone.stressCoefficient < 0.5 && (balance.balanceMm ?? 0) > 0;
}

export function assess(input: StageInput): Assessment {
  const balance = climaticBalance(input);
  const root = rootZone(input);
  const zone = root?.zone ?? null;
  const signals: Signals = { balance, zone, growing: input.crop.kc !== null };
  const level = levelOf(input.date, signals);
  const deficit = level === 'drought' || level === 'risk';
  const sample = new Set(input.sampleSources ?? []);
  const uncertainties: UncertaintyId[] = [];

  if (balance === null && zone === null) uncertainties.push('no_balance');

  if (input.meteo && input.meteo.gridKm > COARSE_GRID_KM) uncertainties.push('coarse_meteo_grid');

  if (!input.soil || input.soil.category === null || sample.has('soil')) uncertainties.push('soil_unknown');
  else if (input.soil.modelled && verdictDependsOnCategory(input.soil, balance))
    uncertainties.push('soil_modelled');

  if (input.soil?.substituteDistanceM !== undefined) uncertainties.push('soil_substitute');

  // pogoda z atrapy to nie pomiar - taka ocena nie moze miec zadnej pewnosci
  if (sample.has('meteo')) uncertainties.push('no_balance');

  if (balance?.coverage !== undefined && balance.coverage < 1) uncertainties.push('meteo_gaps');

  if (conflicting(signals)) uncertainties.push('conflicting_signals');

  if (input.field.landUse && input.field.landUse.length > 0 && !hasFarmland(input.field.landUse))
    uncertainties.push('not_farmland');

  const { assumed } = balanceSoil(input);
  const basis = verdictBasis(balance);
  const substituteM = input.soil?.substituteDistanceM;

  return {
    level,
    confidence: confidenceOf(uncertainties),
    climaticBalance: balance,
    rootZone: zone,
    vegetation: vegetationSignal(input, deficit),
    precipitation: precipitationContext(input),
    soilBasis: assumed ? 'assumed_medium' : substituteM === undefined ? 'field' : 'nearby',
    ...(substituteM === undefined ? {} : { soilDistanceM: substituteM }),
    ...(basis ? { verdictBasis: basis } : {}),
  };
}
