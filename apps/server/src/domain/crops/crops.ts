// Katalog upraw z parametrami bilansu wodnego wg FAO-56 (wspolczynniki Kc, dlugosci faz, glebokosc korzeni,
// frakcja wyczerpania p) i grupa z tabeli progow suszy IUNG. Wartosci startowe: FAO-56 rev. 1 (tab. 6 i 8) oraz
// kalendarz modelowy dla Polski z docs/research/2026-11-21-metodyka-uprawy-walidacja.md - do strojenia w pakiecie
// bilansu (P7); daty faz sa orientacyjne i raport tak je opisuje.
import { CROP_IDS, type CropId, type IungCropGroup } from '@app/contracts';

export interface CropProfile {
  id: CropId;
  /** grupa z tabeli progow KBW; null = brak progow (trwale uzytki zielone) */
  iungGroup: IungCropGroup | null;
  /** wspolczynnik uprawy: poczatek, pelnia rozwoju, koniec sezonu */
  kc: { initial: number; mid: number; end: number };
  /** dlugosci faz w dniach, liczone od poczatku krzywej Kc */
  stageDays: { initial: number; development: number; mid: number; late: number };
  /** poczatek krzywej Kc: siew/sadzenie upraw jarych albo wiosenne ruszenie wegetacji ozimin i wieloletnich */
  seasonStart: { month: number; day: number };
  /** maksymalna efektywna glebokosc korzeni */
  rootDepthM: { min: number; max: number };
  /** frakcja wody dostepnej, ktora roslina pobiera bez stresu (p) */
  depletionFraction: number;
  /** ozima albo wieloletnia: poza krzywa Kc jest w spoczynku, a nie "przed siewem"/"po zbiorze" */
  overwinters: boolean;
}

const PROFILES: readonly CropProfile[] = [
  {
    id: 'winter_wheat',
    iungGroup: 'winter_cereals',
    kc: { initial: 0.7, mid: 1.15, end: 0.25 },
    stageDays: { initial: 20, development: 40, mid: 45, late: 30 },
    seasonStart: { month: 3, day: 20 },
    rootDepthM: { min: 1, max: 1.5 },
    depletionFraction: 0.55,
    overwinters: true,
  },
  {
    id: 'spring_barley',
    iungGroup: 'spring_cereals',
    kc: { initial: 0.3, mid: 1.1, end: 0.25 },
    stageDays: { initial: 20, development: 30, mid: 45, late: 25 },
    seasonStart: { month: 4, day: 1 },
    rootDepthM: { min: 0.6, max: 1.2 },
    depletionFraction: 0.55,
    overwinters: false,
  },
  {
    id: 'maize_grain',
    iungGroup: 'maize_grain',
    kc: { initial: 0.3, mid: 1.2, end: 0.35 },
    stageDays: { initial: 30, development: 40, mid: 50, late: 50 },
    seasonStart: { month: 4, day: 25 },
    rootDepthM: { min: 0.6, max: 1.5 },
    depletionFraction: 0.55,
    overwinters: false,
  },
  {
    id: 'maize_silage',
    iungGroup: 'maize_silage',
    kc: { initial: 0.3, mid: 1.15, end: 0.95 },
    stageDays: { initial: 25, development: 40, mid: 55, late: 20 },
    seasonStart: { month: 4, day: 25 },
    rootDepthM: { min: 0.6, max: 1.5 },
    depletionFraction: 0.5,
    overwinters: false,
  },
  {
    id: 'winter_rapeseed',
    iungGroup: 'rapeseed',
    kc: { initial: 0.5, mid: 1.1, end: 0.35 },
    stageDays: { initial: 15, development: 35, mid: 50, late: 30 },
    seasonStart: { month: 3, day: 15 },
    rootDepthM: { min: 0.8, max: 1.3 },
    depletionFraction: 0.6,
    overwinters: true,
  },
  {
    id: 'potato',
    iungGroup: 'potato',
    kc: { initial: 0.5, mid: 1.1, end: 0.4 },
    stageDays: { initial: 30, development: 35, mid: 50, late: 30 },
    seasonStart: { month: 4, day: 20 },
    rootDepthM: { min: 0.4, max: 0.6 },
    depletionFraction: 0.35,
    overwinters: false,
  },
  {
    id: 'sugar_beet',
    iungGroup: 'sugar_beet',
    kc: { initial: 0.35, mid: 1.1, end: 0.75 },
    stageDays: { initial: 30, development: 50, mid: 90, late: 30 },
    seasonStart: { month: 4, day: 5 },
    rootDepthM: { min: 0.7, max: 1.2 },
    depletionFraction: 0.55,
    overwinters: false,
  },
  {
    id: 'pulses',
    iungGroup: 'pulses',
    kc: { initial: 0.5, mid: 1.1, end: 0.35 },
    stageDays: { initial: 20, development: 30, mid: 40, late: 25 },
    seasonStart: { month: 4, day: 1 },
    rootDepthM: { min: 0.6, max: 1 },
    depletionFraction: 0.4,
    overwinters: false,
  },
  {
    id: 'strawberry',
    iungGroup: 'strawberry',
    kc: { initial: 0.5, mid: 0.8, end: 0.75 },
    stageDays: { initial: 20, development: 30, mid: 60, late: 70 },
    seasonStart: { month: 3, day: 25 },
    rootDepthM: { min: 0.3, max: 0.5 },
    depletionFraction: 0.25,
    overwinters: true,
  },
  {
    id: 'berry_shrubs',
    iungGroup: 'berry_shrubs',
    kc: { initial: 0.3, mid: 1.05, end: 0.5 },
    stageDays: { initial: 20, development: 45, mid: 80, late: 40 },
    seasonStart: { month: 3, day: 25 },
    rootDepthM: { min: 0.6, max: 1.2 },
    depletionFraction: 0.5,
    overwinters: true,
  },
  {
    id: 'fruit_trees',
    iungGroup: 'fruit_trees',
    kc: { initial: 0.5, mid: 0.95, end: 0.6 },
    stageDays: { initial: 20, development: 70, mid: 90, late: 30 },
    seasonStart: { month: 3, day: 25 },
    rootDepthM: { min: 1, max: 2 },
    depletionFraction: 0.5,
    overwinters: true,
  },
  {
    id: 'hops',
    iungGroup: 'hops',
    kc: { initial: 0.3, mid: 1.05, end: 0.85 },
    stageDays: { initial: 25, development: 40, mid: 80, late: 10 },
    seasonStart: { month: 4, day: 10 },
    rootDepthM: { min: 1, max: 1.2 },
    depletionFraction: 0.5,
    overwinters: true,
  },
  {
    id: 'tobacco',
    iungGroup: 'tobacco',
    kc: { initial: 0.35, mid: 1.1, end: 0.9 },
    stageDays: { initial: 20, development: 30, mid: 45, late: 35 },
    seasonStart: { month: 5, day: 15 },
    rootDepthM: { min: 0.3, max: 0.8 },
    depletionFraction: 0.5,
    overwinters: false,
  },
  {
    id: 'field_vegetables',
    iungGroup: 'field_vegetables',
    kc: { initial: 0.7, mid: 1.05, end: 0.95 },
    stageDays: { initial: 25, development: 40, mid: 60, late: 20 },
    seasonStart: { month: 5, day: 1 },
    rootDepthM: { min: 0.3, max: 0.6 },
    depletionFraction: 0.35,
    overwinters: false,
  },
  {
    id: 'grassland',
    iungGroup: null,
    kc: { initial: 0.45, mid: 1.05, end: 0.85 },
    stageDays: { initial: 20, development: 30, mid: 130, late: 30 },
    seasonStart: { month: 3, day: 20 },
    rootDepthM: { min: 0.5, max: 1 },
    depletionFraction: 0.55,
    overwinters: true,
  },
];

const BY_ID = new Map<CropId, CropProfile>(PROFILES.map((profile) => [profile.id, profile]));

export function cropProfile(id: CropId): CropProfile {
  const profile = BY_ID.get(id);

  if (!profile) throw new Error(`Brak profilu uprawy: ${id}`);

  return profile;
}

export const CROP_PROFILES: readonly CropProfile[] = CROP_IDS.map(cropProfile);
