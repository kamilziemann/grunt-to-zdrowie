// Zalecenia (etap `recommend`) w kolejnosci wymaganej przez konkurs KOWR: najpierw zatrzymanie wody w krajobrazie
// (retencja), potem agrotechnika, na koncu nawadnianie - i to tylko wtedy, gdy bilans strefy korzeniowej je
// uzasadnia. Kazde dzialanie wynika z co najmniej jednej przyczyny i niesie jej dowody liczbowe; bez przyczyn nie ma
// dzialan, a bez oceny nie ma tez wskazowki nawadniania. Liczby efektu tylko tam, gdzie sa podstawy (geometria rowu,
// funkcja pedotransferowa, literatura) - zrodla przy regulach. Urzadzenia wodne zawsze z formalnoscia (`legal`).
import type {
  Assessment,
  Cause,
  CauseId,
  Evidence,
  IrrigationAdvice,
  Recommendation,
  RecommendationNote,
  ZoneMap,
} from '@app/contracts';

import type { Recommendations, StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { cropProfile } from '../crops';
import { drainedLowland } from '../drained-lowland';
import { addDays } from '../iso-date';
import { saxtonRawls } from '../soil-water';
import { rootZoneSimulation } from '../water-indicators';
import { zoneForMeasure } from '../zones';
import { ditchWeirNotes, pondNotes, SPRING_NEAR_M } from './notes';

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
  /** formalnosci zalezne od skali (nadpisuja stale) */
  legal?: (input: StageInput) => Recommendation['legal'];
  /** dopiski z otoczenia pola (gotowe zdania) */
  notes?: (input: StageInput) => RecommendationNote[];
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
/** dawka jednorazowa deszczowni: mniej niz 20 mm wyparuje z lisci i wierzchniej warstwy, wiecej niz 30 mm splynie */
const DOSE_MIN_MM = 20;
const DOSE_MAX_MM = 30;
/** zuzycie wody przez uprawe liczone ze sredniej ostatnich dni (albo prognozy) */
const ETC_DAYS = 7;

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

/** zaglebienie mniejsze niz tyle (m3) nie jest warte oczka - wystarczy go nie zasypywac */
const POND_MIN_M3 = 30;
/** staw do 1000 m2 (i 3 m glebokosci) na wlasnym gruncie to zgloszenie wodnoprawne; wiekszy - pozwolenie */
const POND_NOTIFICATION_MAX_M2 = 1000;

/** Najwieksze zaglebienie bezodplywowe w polu z prawdziwego modelu terenu (atrapa nie jest dowodem). */
function fieldDepression(input: StageInput) {
  const largest = input.terrain?.summary.largestDepression;

  return largest && !input.sampleSources?.includes('terrain') && largest.volumeM3 >= POND_MIN_M3
    ? largest
    : null;
}

const POND: Measure = {
  measure: 'small_pond',
  category: 'retention',
  priority: 2,
  effect: null,
  effort: 'high',
  // oczko/zbiornik: zgloszenie (do 1000 m2 i 3 m glebokosci) albo pozwolenie - zalezy od wielkosci i zasilania
  legal: 'notification',
};

/** na piaskach (kategoria I albo < 90 mm/m) woda z niewyscielonego zbiornika szybko wsiaka */
const pondHolds = ({ soil }: StageInput): boolean =>
  soil?.category !== 1 && (soil?.availableWaterMmPerM ?? 0) >= LIGHT_SOIL_MM_PER_M;

/** oczko ma sens poza polderem - tam obnizenie odwadnia przepompownia, a wode zatrzymuje sie w rowach */
const pondFits = (input: StageInput): boolean => pondHolds(input) && !drainedLowland(input).detected;

/** granica pola z drzewami w co najmniej polowie - pas zadrzewien niczego nie doda */
const SHELTERED_SHARE = 0.5;

/** Zrodlo blisko pola - argument za oczkiem (zasilanie latem). */
function springEvidence({ surroundings }: StageInput): Evidence[] {
  const spring = surroundings?.water.nearestSpring ?? null;

  return spring && spring.distanceM <= SPRING_NEAR_M
    ? [
        {
          metric: 'nearest_spring_m',
          value: spring.distanceM,
          unit: 'm',
          reference: SPRING_NEAR_M,
          source: 'hydro',
        },
      ]
    : [];
}

/** Zastawka: jaz w poblizu, styk rowu z rura i dowody polderu. */
function weirEvidence(input: StageInput): Evidence[] {
  const water = input.surroundings?.water;
  const structure = water?.nearestStructure ?? null;
  const junction = water?.pipedJunction ?? null;

  return [
    ...(structure
      ? [{ metric: 'nearest_structure_m', value: structure.distanceM, unit: 'm', source: 'hydro' as const }]
      : []),
    ...(junction
      ? [
          {
            metric: 'piped_junction_m',
            value: junction.distanceM,
            unit: 'm',
            reference: water?.junctionRadiusM ?? 0,
            source: 'hydro' as const,
          },
        ]
      : []),
    ...drainedLowland(input).evidence,
  ];
}

const DITCH_WEIR: Measure = {
  measure: 'ditch_weir',
  category: 'retention',
  priority: 1,
  effect: null,
  effort: 'medium',
  // zastawka to urzadzenie wodne: zgloszenie wodnoprawne i uzgodnienie ze spolka wodna / zarzadca rowu
  legal: 'notification',
};

const weirEffect = ({ hydro }: StageInput): Recommendation['effect'] => {
  const length = hydro?.ditchLengthInFieldM ?? 0;

  return length > 0 ? { kind: 'volume_m3', value: Math.round(length * WEIR_STORAGE_M3_PER_M) } : null;
};

const RULES: readonly Rule[] = [
  // --- retencja: zatrzymac wode w krajobrazie i w rowach, zanim odplynie ---
  {
    measure: DITCH_WEIR,
    answers: ['fast_drainage'],
    effect: weirEffect,
    extraEvidence: weirEvidence,
    notes: (input) => ditchWeirNotes(input, drainedLowland(input)),
  },
  // polder: zamiast oczka w obnizeniu - regulowany odplyw w rowach, takze gdy row nie jest przy samym polu
  {
    measure: DITCH_WEIR,
    answers: [
      'fast_drainage',
      'no_landscape_retention',
      'surface_runoff',
      'precipitation_deficit',
      'crop_sensitivity',
    ],
    when: (input) => drainedLowland(input).detected,
    effect: weirEffect,
    extraEvidence: weirEvidence,
    notes: (input) => ditchWeirNotes(input, drainedLowland(input)),
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
  // oczko w zaglebieniu pola: woda i tak sie tam zbiera - pojemnosc z modelu terenu (do poziomu przelewu)
  {
    measure: { ...POND, priority: 1 },
    answers: ['no_landscape_retention', 'surface_runoff', 'precipitation_deficit', 'crop_sensitivity'],
    when: (input) => fieldDepression(input) !== null && pondFits(input),
    effect: (input) => {
      const depression = fieldDepression(input);

      return depression ? { kind: 'volume_m3', value: depression.volumeM3 } : null;
    },
    legal: (input) =>
      (fieldDepression(input)?.areaM2 ?? 0) > POND_NOTIFICATION_MAX_M2 ? 'permit' : 'notification',
    extraEvidence: (input) => {
      const depression = fieldDepression(input);

      return [
        ...(depression
          ? [
              {
                metric: 'depression_volume_m3',
                value: depression.volumeM3,
                unit: 'm3',
                source: 'terrain' as const,
              },
              {
                metric: 'depression_area_m2',
                value: depression.areaM2,
                unit: 'm2',
                source: 'terrain' as const,
              },
            ]
          : []),
        ...springEvidence(input),
      ];
    },
    notes: pondNotes,
  },
  {
    measure: POND,
    answers: ['no_landscape_retention'],
    when: pondFits,
    extraEvidence: springEvidence,
    notes: pondNotes,
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
    // tylko gdy granica pola jest w wiekszosci bez drzew; pole oslonione (las, zadrzewienia) nie dostaje zalecenia
    when: ({ surroundings }) => !surroundings || surroundings.trees.woodedEdgeShare < SHELTERED_SHARE,
    // "z 1900 m granicy drzewa rosna przy 0 m"
    extraEvidence: ({ surroundings }) =>
      surroundings
        ? [
            {
              metric: 'wooded_edge_m',
              value: surroundings.trees.woodedEdgeM,
              unit: 'm',
              reference: surroundings.trees.edgeM,
              source: 'hydro',
            },
          ]
        : [],
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

function fromRule(
  rule: Rule,
  input: StageInput,
  found: readonly Cause[],
  zones: ZoneMap | null,
): Recommendation | null {
  const matched = found.filter((cause) => rule.answers.includes(cause.id));

  if (matched.length === 0 || (rule.when && !rule.when(input))) return null;

  // ta sama miara z dwoch przyczyn (albo z przyczyny i reguly) idzie do zalecenia raz
  const evidence = [
    ...matched.flatMap((cause) => cause.evidence),
    ...(rule.extraEvidence?.(input) ?? []),
  ].filter(
    (item, index, all) =>
      all.findIndex((other) => other.metric === item.metric && other.source === item.source) === index,
  );
  const [first, ...rest] = evidence;

  if (!first) return null;

  const notes = rule.notes?.(input) ?? [];

  return {
    ...rule.measure,
    ...(rule.effect ? { effect: rule.effect(input) } : {}),
    ...(rule.legal ? { legal: rule.legal(input) } : {}),
    causes: matched.map((cause) => cause.id),
    evidence: [first, ...rest],
    // miejsce na polu: oczko w zaglebieniu, zastawka przy rowie, pas trawiasty na stoku; bez stref - cale pole
    zoneId: zoneForMeasure(rule.measure.measure, zones),
    ...(notes.length > 0 ? { notes } : {}),
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
 * Rozbicie niedoboru na dawki deszczowni: dawka 20-30 mm (nie wiecej niz woda latwo dostepna, zeby nie przelac
 * strefy korzeni), liczba dawek do uzupelnienia niedoboru i odstep = ile dni uprawa zuzywa jedna dawke.
 */
export function irrigationSchedule(
  netDepthMm: number,
  readilyAvailableMm: number,
  etcMmPerDay: number | null,
): { doseMm: number; doses: number; intervalDays?: number } {
  const dose = Math.min(DOSE_MAX_MM, Math.max(DOSE_MIN_MM, Math.round(readilyAvailableMm / 5) * 5));
  const doses = Math.max(1, Math.ceil(netDepthMm / dose));
  const interval =
    etcMmPerDay !== null && etcMmPerDay > 0
      ? Math.min(14, Math.max(2, Math.floor(dose / etcMmPerDay)))
      : null;

  return { doseMm: dose, doses, ...(interval === null ? {} : { intervalDays: interval }) };
}

/** Srednie dobowe zuzycie wody przez uprawe (ETc): z prognozy, a bez niej - z ostatnich dni bilansu. */
function etcPerDay(input: StageInput): number | null {
  const forecast = (input.forecast?.days ?? []).slice(0, ETC_DAYS).flatMap((day, index) => {
    const kc = cropAtDate(input.cropId, addDays(input.date, index + 1)).kc;

    return kc === null || day.et0Mm === null ? [] : [kc * day.et0Mm];
  });
  const recent =
    forecast.length > 0
      ? forecast
      : (rootZoneSimulation(input)
          ?.days.slice(-ETC_DAYS)
          .map((day) => day.potentialEtcMm) ?? []);

  return recent.length > 0 ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null;
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

  const netDepthMm = Math.round(zone.depletionMm);

  return {
    advisable,
    // dawka netto: uzupelnienie do polowej pojemnosci wodnej
    netDepthMm: advisable === 'no' ? null : netDepthMm,
    withinDays: advisable === 'no' ? null : withinDays,
    forecastPrecipMm,
    ...(advisable === 'no' || netDepthMm <= 0
      ? {}
      : irrigationSchedule(netDepthMm, zone.readilyAvailableMm, etcPerDay(input))),
  };
}

export function recommend(
  input: StageInput,
  assessment: Assessment,
  found: Cause[],
  zones: ZoneMap | null = null,
): Recommendations {
  const weightOf = (recommendation: Recommendation) =>
    found
      .filter((cause) => recommendation.causes.includes(cause.id))
      .reduce((sum, cause) => sum + cause.weight, 0);
  const all = RULES.map((rule) => fromRule(rule, input, found, zones))
    .filter((item): item is Recommendation => item !== null)
    // jedno dzialanie raz: pierwsza pasujaca regula (np. oczko w zaglebieniu przed oczkiem "gdziekolwiek")
    .filter((item, index, items) => items.findIndex((other) => other.measure === item.measure) === index)
    .toSorted((a, b) => a.priority - b.priority || weightOf(b) - weightOf(a));

  return {
    retention: all.filter((item) => item.category === 'retention'),
    agrotech: all.filter((item) => item.category === 'agrotech'),
    irrigation: irrigationAdvice(input, assessment),
  };
}
