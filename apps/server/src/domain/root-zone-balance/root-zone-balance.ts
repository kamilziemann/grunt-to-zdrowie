// Dobowy bilans wody w strefie korzeniowej wg FAO-56, rozdz. 8 (https://www.fao.org/4/X0490E/x0490e0e.htm):
// zapas wody dostepnej TAW = 1000 (thetaFC - thetaWP) Zr (rownanie 82), latwo dostepnej RAW = p TAW (83), wyczerpanie
// Dr liczone dzien po dniu (85), wspolczynnik stresu Ks (84) i ewapotranspiracja uprawy ETc adj = Ks Kc ET0 (81).
// Uproszczenia (jawne w raporcie jako oszacowanie): pojedynczy Kc z krzywej uprawy, opad caly efektywny (bez
// splywu), nadwyzka ponad pojemnosc polowa odplywa w glab tego samego dnia, brak podsiaku z wody gruntowej, nowa
// warstwa gleby, w ktora wrastaja korzenie, jest przy pojemnosci polowej. Poza sezonem uprawy liczymy parowanie
// z gleby gola/spoczynkowa roslina (stale Kc), zeby zapas wody na poczatku sezonu wynikal z pogody zimy i wiosny.
import type { CropId } from '@app/contracts';

import type { DailyWeather } from '../analysis-ports';
import { cropAtDate } from '../crop-calendar';
import { cropProfile } from '../crops';
import { dailyEt0 } from '../evapotranspiration';

/** Kc poza sezonem: gleba bez okrywy albo roslina w spoczynku (FAO-56 tab. 12, okolice Kc ini dla rzadkiego deszczu). */
export const OFF_SEASON_KC = 0.35;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export interface RootZoneStepInput {
  /** wyczerpanie na koniec poprzedniego dnia (mm) */
  depletionMm: number;
  precipMm: number;
  irrigationMm?: number;
  /** ewapotranspiracja uprawy bez stresu Kc ET0 (mm) */
  potentialEtcMm: number;
  totalAvailableMm: number;
  /** frakcja p */
  depletionFraction: number;
}

export interface RootZoneStep {
  /** wyczerpanie po opadzie i nawodnieniu, na poczatku dnia */
  startDepletionMm: number;
  stressCoefficient: number;
  actualEtcMm: number;
  deepPercolationMm: number;
  /** wyczerpanie na koniec dnia */
  depletionMm: number;
}

/**
 * Jeden dzien bilansu. Opad i nawodnienie wchodza na poczatku dnia (jak w przykladzie 38 FAO-56), Ks liczymy
 * z wyczerpania na poczatku dnia (przyklad 37), a wyczerpanie nie przekracza TAW (punkt trwalego wiedniecia).
 */
export function rootZoneStep(input: RootZoneStepInput): RootZoneStep {
  const { totalAvailableMm: taw, depletionFraction: p } = input;
  const water = input.precipMm + (input.irrigationMm ?? 0);
  const startDepletionMm = Math.max(input.depletionMm - water, 0);
  const deepPercolationMm = Math.max(water - input.depletionMm, 0);
  const raw = p * taw;
  const stressCoefficient =
    taw <= 0 ? 0 : startDepletionMm <= raw ? 1 : clamp((taw - startDepletionMm) / ((1 - p) * taw), 0, 1);
  const actualEtcMm = stressCoefficient * input.potentialEtcMm;

  return {
    startDepletionMm,
    stressCoefficient,
    actualEtcMm,
    deepPercolationMm,
    depletionMm: Math.min(startDepletionMm + actualEtcMm, Math.max(taw, 0)),
  };
}

export interface RootZoneDay {
  date: string;
  /** null poza sezonem uprawy */
  kc: number | null;
  rootDepthM: number;
  et0Mm: number;
  totalAvailableMm: number;
  readilyAvailableMm: number;
  depletionMm: number;
  stressCoefficient: number;
  potentialEtcMm: number;
  actualEtcMm: number;
}

export interface RootZoneSimulation {
  days: RootZoneDay[];
  /** dni bez opadu albo ET0 w serii (wstawione: opad 0, ET0 z dnia poprzedniego) */
  gapDays: number;
}

export interface RootZoneOptions {
  cropId: CropId;
  /** woda dostepna gleby w mm na metr profilu (1000 x (thetaFC - thetaWP)) */
  availableWaterMmPerM: number;
  latitude: number;
  elevationM: number;
  /** wyczerpanie na poczatku symulacji; domyslnie 0 (profil przy pojemnosci polowej po zimie) */
  initialDepletionMm?: number;
}

/** Symulacja dobowa po calej serii pogody (np. 10 lat przed data analizy). */
export function simulateRootZone(
  weather: readonly DailyWeather[],
  options: RootZoneOptions,
): RootZoneSimulation {
  const profile = cropProfile(options.cropId);
  // poza sezonem korzenie ozimin i roslin wieloletnich sa w glebie; jare - tylko wierzchnia warstwa
  const offSeasonDepth = profile.overwinters ? profile.rootDepthM.max : profile.rootDepthM.min;
  const days: RootZoneDay[] = [];
  let depletion = options.initialDepletionMm ?? 0;
  let lastEt0 = 0;
  let gapDays = 0;

  for (const day of weather) {
    const crop = cropAtDate(options.cropId, day.date);
    const kc = crop.kc;
    const rootDepthM = crop.rootDepthM ?? offSeasonDepth;
    const et0 = dailyEt0(day, options.latitude, options.elevationM)?.et0Mm ?? null;

    if (et0 === null || day.precipMm === null) gapDays += 1;

    const et0Mm = et0 ?? lastEt0;
    const taw = options.availableWaterMmPerM * rootDepthM;
    const potentialEtcMm = (kc ?? OFF_SEASON_KC) * et0Mm;
    const step = rootZoneStep({
      depletionMm: Math.min(depletion, taw),
      precipMm: day.precipMm ?? 0,
      potentialEtcMm,
      totalAvailableMm: taw,
      depletionFraction: profile.depletionFraction,
    });

    lastEt0 = et0Mm;
    depletion = step.depletionMm;
    days.push({
      date: day.date,
      kc,
      rootDepthM,
      et0Mm,
      totalAvailableMm: taw,
      readilyAvailableMm: profile.depletionFraction * taw,
      depletionMm: step.depletionMm,
      stressCoefficient: step.stressCoefficient,
      potentialEtcMm,
      actualEtcMm: step.actualEtcMm,
    });
  }

  return { days, gapDays };
}

export interface SeasonStress {
  /** dni sezonu uprawy ze stresem wodnym (Ks < 1) */
  stressDays: number;
  /** niedobor ewapotranspiracji uprawy: suma (ETc - ETc adj) w sezonie (mm) - miara potrzeby nawodnienia */
  etDeficitMm: number;
  seasonDays: number;
}

/** Podsumowanie dni z sezonu uprawy (kc != null) od `from` do `to` wlacznie. */
export function seasonStress(days: readonly RootZoneDay[], from: string, to: string): SeasonStress {
  let stressDays = 0;
  let etDeficitMm = 0;
  let seasonDays = 0;

  for (const day of days) {
    if (day.date < from || day.date > to || day.kc === null) continue;

    seasonDays += 1;
    etDeficitMm += day.potentialEtcMm - day.actualEtcMm;

    if (day.stressCoefficient < 1) stressDays += 1;
  }

  return { stressDays, etDeficitMm, seasonDays };
}
