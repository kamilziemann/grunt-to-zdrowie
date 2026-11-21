// Zalecenia (etap `recommend`) w kolejnosci wymaganej przez konkurs KOWR: najpierw zatrzymanie wody w krajobrazie
// (retencja), potem agrotechnika, na koncu nawadnianie - i to tylko wtedy, gdy bilans strefy korzeniowej je
// uzasadnia. Kazde dzialanie wynika z co najmniej jednej przyczyny i niesie jej dowody liczbowe; bez przyczyn nie ma
// dzialan, a bez oceny nie ma tez wskazowki nawadniania. Liczby efektu tylko tam, gdzie sa podstawy (geometria rowu,
// funkcja pedotransferowa, literatura) - zrodla przy regulach. Urzadzenia wodne zawsze z formalnoscia (`legal`).
import type { Assessment, Cause, CauseId, Evidence, IrrigationAdvice, Recommendation } from '@app/contracts';

import type { Recommendations, StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { cropProfile } from '../crops';
import { addDays } from '../iso-date';
import { saxtonRawls } from '../soil-water';

type Measure = Omit<Recommendation, 'causes' | 'evidence' | 'zoneId'>;

interface Rule {
  measure: Measure;
  /** przyczyny, na ktore dzialanie odpowiada (wystarczy jedna obecna) */
  answers: readonly CauseId[];
  /** dodatkowy warunek na danych; brak = zawsze, gdy jest przyczyna */
  when?: (input: StageInput) => boolean;
  /** dowody spoza przyczyn (np. odleglosc do mokradla) */
  extraEvidence?: (input: StageInput) => Evidence[];
  /** szacunek efektu z danych pola (nadpisuje staly efekt) */
  effect?: (input: StageInput) => Recommendation['effect'];
}

/**
 * Podpietrzenie zastawka: ok. 0,4 m3 wody na metr rowu (piętrzenie ok. 0,4 m przy lustrze ok. 2 m, klin cofki
 * = polowa przekroju). Rzad wielkosci do rozmowy ze spolka wodna, nie projekt.
 */
const WEIR_STORAGE_M3_PER_M = 0.4;
/** mulcz z resztek: FAO-56 rozdz. 11 - ok. 5% mniej parowania z gleby na 10% pokrycia; przy pokryciu 50% = 25% */
const MULCH_EVAPORATION_CUT_PCT = 25;
const TOPSOIL_M = 0.3;
/** gleba ponizej tej retencji (mm/m) przepuszcza wode ze zbiornika bez uszczelnienia */
const LIGHT_SOIL_MM_PER_M = 90;
/** mokradlo blizej niz 300 m warto chronic jako czesc retencji otoczenia pola */
const WETLAND_NEAR_M = 300;
/** przy niedoborze (Ks) ponizej 0,6 nawodnienie jest pilne */
const SEVERE_STRESS_KS = 0.6;
/** wyczerpanie przekroczy wode latwo dostepna w ciagu tylu dni - czas przygotowac nawodnienie */
const SOON_DAYS = 3;
const RIPENING_KC_SHARE = 0.8;

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** Ile mm wody dostepnej w warstwie ornej (0-30 cm) daje +1 punkt procentowy materii organicznej (Saxton-Rawls). */
export function organicMatterGainMm(input: StageInput): number | null {
  const { soil } = input;

  if (!soil) return null;

  const texture = { sandPct: soil.sandPct, clayPct: soil.clayPct };
  const now = saxtonRawls({ ...texture, organicMatterPct: soil.organicMatterPct });
  const more = saxtonRawls({ ...texture, organicMatterPct: soil.organicMatterPct + 1 });

  return round(Math.max(0, more.availableWater - now.availableWater) * TOPSOIL_M * 1000);
}

const RULES: readonly Rule[] = [
  // --- retencja: zatrzymac wode w krajobrazie i w rowach, zanim odplynie ---
  {
    measure: {
      measure: 'ditch_weir',
      category: 'retention',
      priority: 1,
      effect: null,
      effort: 'medium',
      // zastawka to urzadzenie wodne: zgloszenie wodnoprawne i uzgodnienie ze spolka wodna / zarzadca rowu
      legal: 'notification',
    },
    answers: ['fast_drainage'],
    effect: ({ hydro }) => {
      const length = hydro?.ditchLengthInFieldM ?? 0;

      return length > 0 ? { kind: 'volume_m3', value: Math.round(length * WEIR_STORAGE_M3_PER_M) } : null;
    },
  },
  {
    measure: {
      measure: 'protect_wetland',
      category: 'retention',
      priority: 2,
      effect: null,
      effort: 'low',
      legal: 'none',
    },
    answers: ['precipitation_deficit', 'high_evaporative_demand', 'low_soil_retention', 'crop_sensitivity'],
    when: ({ hydro }) =>
      hydro?.nearestWetlandM !== undefined &&
      hydro.nearestWetlandM !== null &&
      hydro.nearestWetlandM <= WETLAND_NEAR_M,
    extraEvidence: ({ hydro }) => [
      {
        metric: 'nearest_wetland_m',
        value: hydro?.nearestWetlandM ?? 0,
        unit: 'm',
        reference: WETLAND_NEAR_M,
        source: 'hydro',
      },
    ],
  },
  {
    measure: {
      measure: 'small_pond',
      category: 'retention',
      priority: 2,
      effect: null,
      effort: 'high',
      // oczko/zbiornik: zgloszenie (do 1000 m2 i 3 m glebokosci) albo pozwolenie - zalezy od wielkosci i zasilania
      legal: 'notification',
    },
    answers: ['no_landscape_retention'],
    // na piaskach (kategoria I albo < 90 mm/m) woda z niewyscielonego zbiornika szybko wsiaka
    when: ({ soil }) => soil?.category !== 1 && (soil?.availableWaterMmPerM ?? 0) >= LIGHT_SOIL_MM_PER_M,
  },
  {
    measure: {
      measure: 'grassed_waterway',
      category: 'retention',
      priority: 1,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
    answers: ['surface_runoff'],
  },
  {
    measure: {
      measure: 'field_margin_trees',
      category: 'retention',
      priority: 3,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
    answers: ['no_landscape_retention', 'high_evaporative_demand'],
  },
  // --- agrotechnika: wiecej wody w glebie i mniej parowania ---
  {
    measure: {
      measure: 'mulch_residue',
      category: 'agrotech',
      priority: 1,
      effect: { kind: 'evaporation_pct', value: MULCH_EVAPORATION_CUT_PCT },
      effort: 'low',
      legal: 'none',
    },
    answers: ['precipitation_deficit', 'high_evaporative_demand'],
  },
  {
    measure: {
      measure: 'organic_matter',
      category: 'agrotech',
      priority: 1,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
    answers: ['low_soil_retention'],
    extraEvidence: ({ soil }) =>
      soil ? [{ metric: 'organic_matter_pct', value: soil.organicMatterPct, unit: '%', source: 'soil' }] : [],
    effect: (input) => {
      const gain = organicMatterGainMm(input);

      return gain === null ? null : { kind: 'water_mm', value: gain };
    },
  },
  {
    measure: {
      measure: 'contour_farming',
      category: 'agrotech',
      priority: 2,
      effect: null,
      effort: 'low',
      legal: 'none',
    },
    answers: ['surface_runoff'],
  },
  {
    measure: {
      measure: 'cover_crop',
      category: 'agrotech',
      priority: 2,
      effect: null,
      effort: 'low',
      legal: 'none',
    },
    answers: ['low_soil_retention', 'crop_sensitivity'],
  },
  {
    measure: {
      measure: 'reduced_tillage',
      category: 'agrotech',
      priority: 2,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
    answers: ['high_evaporative_demand', 'precipitation_deficit'],
  },
  {
    measure: {
      measure: 'crop_choice',
      category: 'agrotech',
      priority: 3,
      effect: null,
      effort: 'medium',
      legal: 'none',
    },
    answers: ['crop_sensitivity'],
  },
];

function fromRule(rule: Rule, input: StageInput, found: readonly Cause[]): Recommendation | null {
  const matched = found.filter((cause) => rule.answers.includes(cause.id));

  if (matched.length === 0 || (rule.when && !rule.when(input))) return null;

  const evidence = [...matched.flatMap((cause) => cause.evidence), ...(rule.extraEvidence?.(input) ?? [])];
  const [first, ...rest] = evidence;

  if (!first) return null;

  return {
    ...rule.measure,
    ...(rule.effect ? { effect: rule.effect(input) } : {}),
    causes: matched.map((cause) => cause.id),
    evidence: [first, ...rest],
    // miejsca na polu wskaze dopiero podzial na strefy z modelu terenu (pakiet P12) - dzis cale pole
    zoneId: null,
  };
}

/** Dni do przekroczenia wody latwo dostepnej wg prognozy (0 = juz przekroczona); null = nie w horyzoncie. */
function daysUntilStress(input: StageInput, depletionMm: number, readilyMm: number): number | null {
  if (depletionMm > readilyMm) return 0;

  let depletion = depletionMm;

  for (const [index, day] of (input.forecast?.days ?? []).entries()) {
    const kc = cropAtDate(input.cropId, addDays(input.date, index + 1)).kc ?? 0;

    depletion = Math.max(0, depletion + kc * (day.et0Mm ?? 0) - (day.precipMm ?? 0));

    if (depletion > readilyMm) return index + 1;
  }

  return null;
}

/**
 * Nawadnianie: tylko z bilansu strefy korzeniowej, w okresie wzrostu przed dojrzewaniem i przy ocenie wskazujacej
 * niedobor.
 */
export function irrigationAdvice(input: StageInput, assessment: Assessment): IrrigationAdvice | null {
  const zone = assessment.rootZone;

  if (!zone || assessment.level === 'unknown') return null;

  const forecast = input.forecast?.days ?? [];
  const forecastPrecipMm =
    forecast.length === 0 ? null : round(forecast.reduce((sum, day) => sum + (day.precipMm ?? 0), 0));
  const growing = input.crop.kc !== null;
  // dojrzewanie (faza koncowa, Kc ponizej 80% Kc pelni): woda juz nie zwieksza plonu - nie nawadniamy
  const ripening =
    input.crop.stage === 'late' &&
    input.crop.kc !== null &&
    input.crop.kc < cropProfile(input.cropId).kc.mid * RIPENING_KC_SHARE;
  const deficit = ['watch', 'risk', 'drought'].includes(assessment.level);
  const withinDays =
    forecast.length > 0 || zone.depletionMm > zone.readilyAvailableMm
      ? daysUntilStress(input, zone.depletionMm, zone.readilyAvailableMm)
      : null;
  const stressed = zone.depletionMm > zone.readilyAvailableMm;
  // deszcz z prognozy, ktory pokryje niedobor, zastepuje nawodnienie
  const rainCovers = forecastPrecipMm !== null && forecastPrecipMm >= zone.depletionMm;
  let advisable: IrrigationAdvice['advisable'] = 'no';

  if (growing && !ripening && deficit && !rainCovers) {
    if (stressed && zone.stressCoefficient < SEVERE_STRESS_KS) advisable = 'yes';
    else if (stressed || (withinDays !== null && withinDays <= SOON_DAYS)) advisable = 'consider';
  }

  return {
    advisable,
    // dawka netto: uzupelnienie do polowej pojemnosci wodnej
    netDepthMm: advisable === 'no' ? null : Math.round(zone.depletionMm),
    withinDays: advisable === 'no' ? null : withinDays,
    forecastPrecipMm,
  };
}

export function recommend(input: StageInput, assessment: Assessment, found: Cause[]): Recommendations {
  const weightOf = (recommendation: Recommendation) =>
    found
      .filter((cause) => recommendation.causes.includes(cause.id))
      .reduce((sum, cause) => sum + cause.weight, 0);
  const all = RULES.map((rule) => fromRule(rule, input, found))
    .filter((item): item is Recommendation => item !== null)
    .toSorted((a, b) => a.priority - b.priority || weightOf(b) - weightOf(a));

  return {
    retention: all.filter((item) => item.category === 'retention'),
    agrotech: all.filter((item) => item.category === 'agrotech'),
    irrigation: irrigationAdvice(input, assessment),
  };
}
