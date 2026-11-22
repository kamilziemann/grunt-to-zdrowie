// Uzgodnienie gleby z modelu (SoilGrids 250 m) z klasa bonitacyjna z ewidencji gruntow (EGiB). Model globalny myli
// sie zwykle "w strone ciezszej gleby" (docs/validation.md), a klasa z ewidencji to dokument dla tej dzialki:
// - same klasy V-VI (najslabsze grunty orne i uzytki zielone) przy kategorii III-IV z modelu -> gleba lekka
//   (kategoria II, a dla samej klasy VI - I);
// - same klasy I-II przy kategorii I-II z modelu -> co najmniej kategoria III.
// Klasy srodkowe (III-IV) i dzialki z mieszanymi klasami zostaja przy modelu - bonitacja to nie uziarnienie, wiec
// poprawiamy tylko wyrazna sprzecznosc. Poprawka zmienia kategorie do progu IUNG i zapas wody do bilansu strefy
// korzeniowej (srodek przedzialu WOD kategorii); raport mowi o niej wprost i obniza pewnosc.
import type { SoilProfile } from '../analysis-ports';
import type { SoilCategory } from '@app/contracts';
import { soilClassNumber, soilClassesOf } from '../land-use';

/** Woda dostepna w profilu 1,5 m typowa dla kategorii (srodki przedzialow WOD IUNG: <127,5 / 170 / 202,5 mm). */
const PROFILE_WATER_MM: Readonly<Record<SoilCategory, number>> = { 1: 110, 2: 150, 3: 186, 4: 220 };
const PROFILE_M = 1.5;

export interface SoilRegistryConflict {
  /** kierunek poprawki: ewidencja mowi o glebie lzejszej albo ciezszej niz model */
  direction: 'lighter' | 'heavier';
  modelCategory: SoilCategory;
  category: SoilCategory;
  /** klasy bonitacyjne dzialki, np. ['V', 'VI'] */
  classes: string[];
}

/** Kategoria, ktorej wymaga wyrazna klasa z ewidencji; null = ewidencja nie przesadza. */
function registryCategory(classes: readonly number[], model: SoilCategory): SoilCategory | null {
  if (classes.length === 0) return null;

  const best = Math.min(...classes);
  const worst = Math.max(...classes);

  if (best >= 5) {
    const target: SoilCategory = best === 6 ? 1 : 2;

    return model > target ? target : null;
  }

  if (worst <= 2) return model < 3 ? 3 : null;

  return null;
}

/** Gleba po uzgodnieniu z ewidencja; `conflict` opisuje poprawke (null = model i ewidencja sie nie kloca). */
export function reconcileSoilWithRegistry(
  soil: SoilProfile,
  landUse: readonly string[] | undefined,
): { soil: SoilProfile; conflict: SoilRegistryConflict | null } {
  const classes = soilClassesOf(landUse ?? []);
  const numbers = classes.flatMap((soilClass) => {
    const value = soilClassNumber(soilClass);

    return value === null ? [] : [value];
  });

  if (soil.category === null || !soil.modelled) return { soil, conflict: null };

  const target = registryCategory(numbers, soil.category);

  if (target === null) return { soil, conflict: null };

  const [low, high] = soil.categoryRange ?? [soil.category, soil.category];
  const profileMm = PROFILE_WATER_MM[target];

  return {
    soil: {
      ...soil,
      category: target,
      categoryRange: [Math.min(low, target) as SoilCategory, Math.max(high, target) as SoilCategory],
      availableWaterProfileMm: profileMm,
      availableWaterMmPerM: Math.round((profileMm / PROFILE_M) * 10) / 10,
      basis: 'both',
    },
    conflict: {
      direction: target < soil.category ? 'lighter' : 'heavier',
      modelCategory: soil.category,
      category: target,
      classes,
    },
  };
}
