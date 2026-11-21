// Przyczyny niedoboru wody (etap `causes`): kazda przyczyna to jawna regula na danych z raportu z dowodem liczbowym
// i waga 0-1 (jak mocno tlumaczy niedobor). Przyczyny szukamy, gdy ocena mowi o niedoborze (obserwuj, ryzyko,
// susza) albo gdy niedobor wraca w historii (min. 30% sezonow: prog IUNG albo >= 50 mm niedoboru wg bilansu) - wtedy tylko przyczyny trwale (gleba, odplyw,
// krajobraz, wrazliwosc uprawy), bo pogoda z daty analizy niczego nie tlumaczy. Bez oceny przyczyn nie ma.
// Dane ze zrodel przykladowych (atrap) nie sa dowodem - reguly je pomijaja.
import type { Assessment, Cause, Evidence, History, SourceId } from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import { yearOf } from '../iso-date';
import { deficitSeasons } from '../history';
import { iungPeriodEndingBy, iungPeriods } from '../iung-periods';
import { soilClassNumber, soilClassesOf } from '../land-use';
import { terrainTooCoarse } from '../terrain';
import { assessPeriod } from '../water-indicators';

const HISTORY_YEARS = 10;
/** opad okresu ponizej 80% mediany z lat poprzednich = niedobor opadu */
const LOW_PRECIP_SHARE = 0.8;
/** parowanie okresu powyzej 110% mediany = duze zapotrzebowanie atmosfery */
const HIGH_ETP_SHARE = 1.1;
/** woda dostepna ponizej tej wartosci (mm/m) to mala retencja; 150 mm/m ma typowa glina */
const LOW_AVAILABLE_WATER_MM_PER_M = 130;
const TYPICAL_AVAILABLE_WATER_MM_PER_M = 150;
/** row blizej niz 50 m od granicy (albo przez pole) odprowadza wode z pola */
const DITCH_AT_FIELD_M = 50;
/** niedobor wraca: niedobor w co najmniej 30% sezonow z danymi (min. 5 sezonow) */
/** sezon z niedoborem wg bilansu strefy korzeniowej: uprawie zabraklo co najmniej tyle wody */
const RECURRENT_SHARE = 0.3;
const MIN_SEASONS = 5;
/** wrazliwosc uprawy: niedobor w co najmniej 40% sezonow */
const SENSITIVE_SHARE = 0.4;
const SLOPE_RUNOFF_PCT = 3;
/** albo co najmniej czwarta czesc pola na stokach > 5% - tam woda z ulewy splywa, zanim wsiaknie */
const STEEP_SHARE_RUNOFF = 0.25;
/** waga przyczyn z modelu terenu na polu za malym dla modelu 30 m */
const COARSE_TERRAIN_WEIGHT = 0.5;

const DEFICIT_LEVELS: ReadonlySet<Assessment['level']> = new Set(['watch', 'risk', 'drought']);

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));
const clamp = (value: number, min = 0.1, max = 1): number => Math.min(Math.max(value, min), max);

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;

  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Mediana opadu i parowania tego samego okresu IUNG w 10 latach przed data analizy. */
function periodNorms(input: StageInput, periodNo: number): { precipMm: number | null; etpMm: number | null } {
  const past = Array.from({ length: HISTORY_YEARS }, (_unused, index) => yearOf(input.date) - 1 - index)
    .flatMap((year) => {
      const period = iungPeriods(year)[periodNo - 1];

      return period ? [assessPeriod(input, period, null, 1).balance] : [];
    })
    .filter((balance) => balance.balanceMm !== null);

  return {
    precipMm: median(past.flatMap((balance) => (balance.precipMm === null ? [] : [balance.precipMm]))),
    etpMm: median(
      past.flatMap((balance) =>
        balance.evapotranspirationMm === null ? [] : [balance.evapotranspirationMm],
      ),
    ),
  };
}

/** Roslinnosc ponizej tej samej pory z lat poprzednich - dowod wspierajacy przyczyny pogodowe. */
function vegetationEvidence(assessment: Assessment): Evidence[] {
  const signal = assessment.vegetation;

  if (!signal || signal.interpretation !== 'confirms_deficit' || signal.ndmiAnomaly === null) return [];

  return [
    { metric: 'ndmi_anomaly', value: signal.ndmiAnomaly, unit: 'index', reference: 0, source: 'vegetation' },
    ...(signal.ndviAnomaly === null
      ? []
      : [
          {
            metric: 'ndvi_anomaly',
            value: signal.ndviAnomaly,
            unit: 'index',
            reference: 0,
            source: 'vegetation' as const,
          },
        ]),
  ];
}

/** Granica pola bez drzew (BDOT10k): "z 1900 m granicy drzewa rosna przy 0 m". */
function openFieldEvidence({ surroundings }: StageInput): Evidence[] {
  if (!surroundings?.trees.openToWind) return [];

  return [
    {
      metric: 'wooded_edge_m',
      value: surroundings.trees.woodedEdgeM,
      unit: 'm',
      reference: surroundings.trees.edgeM,
      source: 'hydro',
    },
  ];
}

function weatherCauses(input: StageInput, assessment: Assessment): Cause[] {
  const balance = assessment.climaticBalance;
  const period = iungPeriodEndingBy(input.date);
  const found: Cause[] = [];

  if (!balance || !period || balance.precipMm === null || balance.evapotranspirationMm === null) return found;

  const norms = periodNorms(input, period.no);
  const recent = assessment.precipitation;

  if (norms.precipMm !== null && norms.precipMm > 0 && balance.precipMm < norms.precipMm * LOW_PRECIP_SHARE) {
    found.push({
      id: 'precipitation_deficit',
      weight: round(clamp(1 - balance.precipMm / norms.precipMm), 2),
      evidence: [
        {
          metric: 'precip_period',
          value: balance.precipMm,
          unit: 'mm',
          reference: round(norms.precipMm),
          source: 'meteo',
        },
        ...(recent
          ? [
              {
                metric: 'precip_30d',
                value: recent.sumMm,
                unit: 'mm',
                reference: recent.medianMm,
                source: 'meteo' as const,
              },
            ]
          : []),
      ],
    });
  }

  if (norms.etpMm !== null && balance.evapotranspirationMm > norms.etpMm * HIGH_ETP_SHARE) {
    found.push({
      id: 'high_evaporative_demand',
      weight: round(clamp((balance.evapotranspirationMm / norms.etpMm - 1) * 3), 2),
      evidence: [
        {
          metric: 'et_period',
          value: balance.evapotranspirationMm,
          unit: 'mm',
          reference: round(norms.etpMm),
          source: 'meteo',
        },
      ],
    });
  }

  // pole otwarte na wiatr (granica bez drzew) paruje wiecej - dowod przy zapotrzebowaniu atmosfery
  found.find((cause) => cause.id === 'high_evaporative_demand')?.evidence.push(...openFieldEvidence(input));

  // roslinnosc ponizej normy wzmacnia najsilniejsza przyczyne pogodowa (osobnej przyczyny w katalogu nie ma)
  const strongest = found.toSorted((a, b) => b.weight - a.weight)[0];

  if (strongest) strongest.evidence.push(...vegetationEvidence(assessment));

  return found;
}

function soilCause(input: StageInput, real: (id: SourceId) => boolean): Cause | null {
  const { soil } = input;

  if (!soil || !real('soil')) return null;

  const light = soil.category !== null && soil.category <= 2;

  if (!light && soil.availableWaterMmPerM >= LOW_AVAILABLE_WATER_MM_PER_M) return null;

  return {
    id: 'low_soil_retention',
    weight: round(
      clamp((TYPICAL_AVAILABLE_WATER_MM_PER_M + 10 - soil.availableWaterMmPerM) / 80, 0.2, 0.9),
      2,
    ),
    evidence: [
      {
        metric: 'available_water_mm_per_m',
        value: soil.availableWaterMmPerM,
        unit: 'mm/m',
        reference: TYPICAL_AVAILABLE_WATER_MM_PER_M,
        source: 'soil',
      },
      ...(soil.category === null
        ? []
        : [{ metric: 'soil_category', value: soil.category, unit: 'category', source: 'soil' as const }]),
      ...registryClassEvidence(input),
    ],
  };
}

/** Najslabsza klasa bonitacyjna gruntu rolnego z ewidencji (1-6) - dowod z dokumentu, nie z modelu. */
function registryClassEvidence(input: StageInput): Evidence[] {
  const classes = soilClassesOf(input.field.landUse ?? []).flatMap((soilClass) => {
    const value = soilClassNumber(soilClass);

    return value === null ? [] : [value];
  });

  if (classes.length === 0) return [];

  return [{ metric: 'registry_soil_class', value: Math.max(...classes), unit: 'class', source: 'parcel' }];
}

function landscapeCauses(input: StageInput, real: (id: SourceId) => boolean): Cause[] {
  const { hydro, terrain } = input;
  const found: Cause[] = [];

  if (hydro && real('hydro')) {
    const inField = (hydro.ditchLengthInFieldM ?? 0) > 0;

    if (hydro.nearestDitchM !== null && (inField || hydro.nearestDitchM <= DITCH_AT_FIELD_M)) {
      found.push({
        id: 'fast_drainage',
        weight: inField ? 0.5 : 0.35,
        evidence: [
          {
            metric: 'nearest_ditch_m',
            value: hydro.nearestDitchM,
            unit: 'm',
            reference: DITCH_AT_FIELD_M,
            source: 'hydro',
          },
          ...(inField
            ? [
                {
                  metric: 'ditch_length_in_field_m',
                  value: hydro.ditchLengthInFieldM ?? 0,
                  unit: 'm',
                  source: 'hydro' as const,
                },
              ]
            : []),
          ...(hydro.ditchesInRadius === undefined
            ? []
            : [
                {
                  metric: 'ditches_in_radius',
                  value: hydro.ditchesInRadius,
                  unit: 'count',
                  reference: hydro.searchRadiusM,
                  source: 'hydro' as const,
                },
              ]),
        ],
      });
    }

    if (hydro.waterBodies === 0 && hydro.wetlands === 0) {
      found.push({
        id: 'no_landscape_retention',
        weight: 0.3,
        evidence: [
          {
            metric: 'water_bodies_in_radius',
            value: 0,
            unit: 'count',
            reference: hydro.searchRadiusM,
            source: 'hydro',
          },
          {
            metric: 'wetlands_in_radius',
            value: 0,
            unit: 'count',
            reference: hydro.searchRadiusM,
            source: 'hydro',
          },
          ...openFieldEvidence(input),
        ],
      });
    }
  }

  const steep = terrain ? terrain.summary.slopeShareAbove5Pct >= STEEP_SHARE_RUNOFF : false;

  if (terrain && real('terrain') && (terrain.summary.slopeMeanPct >= SLOPE_RUNOFF_PCT || steep)) {
    // model 30 m na malym polu: spadek to przyblizenie - przyczyna zostaje, ale z mniejsza waga
    const coarse = terrainTooCoarse(input.field.areaHa) ? COARSE_TERRAIN_WEIGHT : 1;

    found.push({
      id: 'surface_runoff',
      weight: round(clamp((terrain.summary.slopeMeanPct / 10) * coarse, 0.1, 1), 2),
      evidence: [
        {
          metric: 'slope_mean_pct',
          value: terrain.summary.slopeMeanPct,
          unit: '%',
          reference: SLOPE_RUNOFF_PCT,
          source: 'terrain',
        },
        {
          metric: 'slope_share_above_5_pct',
          value: terrain.summary.slopeShareAbove5Pct,
          unit: 'share',
          reference: STEEP_SHARE_RUNOFF,
          source: 'terrain',
        },
      ],
    });
  }

  return found;
}

/** Czy niedobor wraca w historii pola (min. 30% sezonow z niedoborem, z co najmniej 5 sezonow). */
export function recurrentDeficit(history: History | undefined): boolean {
  const { deficit, withData } = deficitSeasons(history);

  return withData >= MIN_SEASONS && deficit / withData >= RECURRENT_SHARE;
}

function cropCause(history: History | undefined): Cause | null {
  const { deficit, withData } = deficitSeasons(history);

  if (withData < MIN_SEASONS || deficit / withData < SENSITIVE_SHARE) return null;

  const typicalDeficit = median(
    (history?.seasons ?? []).flatMap((season) =>
      season.etDeficitMm === null || season.etDeficitMm === undefined ? [] : [season.etDeficitMm],
    ),
  );

  return {
    id: 'crop_sensitivity',
    weight: round(clamp(deficit / withData), 2),
    evidence: [
      { metric: 'deficit_seasons', value: deficit, unit: 'seasons', reference: withData, source: 'meteo' },
      ...(history
        ? [
            {
              metric: 'drought_seasons',
              value: history.droughtSeasons,
              unit: 'seasons',
              reference: history.seasonsWithData,
              source: 'meteo' as const,
            },
          ]
        : []),
      ...(typicalDeficit === null
        ? []
        : [
            {
              metric: 'season_et_deficit_median',
              value: round(typicalDeficit),
              unit: 'mm',
              source: 'meteo' as const,
            },
          ]),
    ],
  };
}

export function causes(input: StageInput, assessment: Assessment, history?: History): Cause[] {
  const deficitNow = DEFICIT_LEVELS.has(assessment.level);

  if (assessment.level === 'unknown' || assessment.level === 'excess') return [];

  if (!deficitNow && !recurrentDeficit(history)) return [];

  const sample = new Set(input.sampleSources ?? []);
  const real = (id: SourceId) => !sample.has(id);
  const found = [
    ...(deficitNow ? weatherCauses(input, assessment) : []),
    soilCause(input, real),
    ...landscapeCauses(input, real),
    cropCause(history),
  ].filter((cause): cause is Cause => cause !== null);

  return found.toSorted((a, b) => b.weight - a.weight);
}
