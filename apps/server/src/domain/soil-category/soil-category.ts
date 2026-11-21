// Kategoria podatnosci gleby na susze (IUNG I-IV) z uziarnienia. Dwa kroki:
// 1. grupa granulometryczna PTG 2008 (Klasyfikacja uziarnienia gleb i utworow mineralnych, tab. 2; frakcje jak
//    USDA: piasek 2-0,05 mm, pyl 0,05-0,002 mm, il < 0,002 mm - tak samo jak w SoilGrids),
// 2. grupa -> kategoria wg ciezkosci agronomicznej z PTG 2008 (Aneks 4): bardzo lekkie -> I, lekkie -> II,
//    srednie -> III, ciezkie i bardzo ciezkie -> IV. Listy grup na https://susza.iung.pulawy.pl/kategorie/ sa
//    w starej klasyfikacji (BN-78) i pokrywaja sie dokladnie z kategoriami agronomicznymi; przejscie przez PTG 2008
//    myli sie znanym kosztem dwoch grup (psp trafia do II zamiast I, pgmp do III zamiast II).
// IUNG ocenia caly profil do 1,5 m z mapy glebowo-rolniczej - kategoria z uziarnienia modelu jest przyblizeniem.
import type { SoilCategory } from '@app/contracts';

export interface TextureFractions {
  sandPct: number;
  siltPct: number;
  clayPct: number;
}

export const PTG_TEXTURE_CLASSES = [
  'pl',
  'ps',
  'pg',
  'gp',
  'gl',
  'gpi',
  'gz',
  'gi',
  'gpyi',
  'pyg',
  'pyz',
  'pyi',
  'ip',
  'ipy',
  'iz',
  'ic',
] as const;

export type PtgTextureClass = (typeof PTG_TEXTURE_CLASSES)[number];

type Rule = (s: number, si: number, c: number) => boolean;

/** Reguly z tab. 2 PTG 2008 (S - piasek, Si - pyl, C - il, w %), w kolejnosci tabeli. */
const RULES: readonly [PtgTextureClass, Rule][] = [
  ['pl', (s, si, c) => s >= 90 && si + 2 * c <= 10],
  ['ps', (s, si, c) => s >= 85 && s < 95 && si + 2 * c > 10 && si + 1.5 * c <= 15],
  ['pg', (s, si, c) => s >= 70 && s < 90 && si + 1.5 * c > 15 && si + 2 * c <= 30],
  [
    'gp',
    (s, si, c) =>
      si + 2 * c > 30 &&
      ((s >= 65 && s < 85 && si <= 35 && c <= 20) || (s >= 43 && s < 65 && si >= 28 && si <= 50 && c <= 7)),
  ],
  ['gl', (s, si, c) => s >= 52 && s < 65 && si > 15 && si <= 41 && c > 7 && c <= 20],
  ['gpi', (s, si, c) => s >= 45 && s < 80 && si <= 28 && c > 20 && c <= 35],
  ['gz', (s, si, c) => s >= 23 && s < 52 && si > 28 && si <= 50 && c > 7 && c <= 27],
  ['gi', (s, si, c) => s >= 20 && s < 45 && si > 15 && si < 53 && c > 27 && c <= 40],
  ['gpyi', (s, si, c) => s < 20 && si > 40 && si <= 73 && c > 27 && c <= 40],
  ['pyg', (s, si, c) => s >= 8 && s < 50 && si > 50 && si <= 80 && c <= 12],
  ['pyz', (s, si, c) => s < 20 && si > 80 && c <= 12],
  ['pyi', (s, si, c) => s < 38 && si > 50 && si < 88 && c > 12 && c <= 27],
  ['ip', (s, si, c) => s >= 45 && s < 65 && si <= 20 && c > 35 && c <= 55],
  ['ipy', (s, si, c) => s < 20 && si > 40 && si < 60 && c > 40 && c < 60],
  ['iz', (s, si, c) => s < 45 && si <= 40 && c > 40 && c <= 60],
  ['ic', (s, si, c) => s < 40 && si < 40 && c > 60],
];

/** Ciezkosc agronomiczna (PTG 2008, Aneks 4) jako kategoria IUNG. */
const CATEGORY_OF_CLASS: Readonly<Record<PtgTextureClass, SoilCategory>> = {
  pl: 1,
  ps: 1,
  pg: 2,
  gp: 3,
  gl: 3,
  pyg: 3,
  pyz: 3,
  gpi: 4,
  gz: 4,
  gi: 4,
  gpyi: 4,
  pyi: 4,
  ip: 4,
  ipy: 4,
  iz: 4,
  ic: 4,
};

/** Granice WOD (woda dostepna w profilu do 1,5 m, mm) miedzy kategoriami wg IUNG. */
export const IUNG_WATER_LIMITS_MM = [127.5, 170, 202.5] as const;

function normalized({ sandPct, siltPct, clayPct }: TextureFractions): [number, number, number] {
  const total = sandPct + siltPct + clayPct;

  if (total <= 0) return [0, 0, 0];

  return [(sandPct * 100) / total, (siltPct * 100) / total, (clayPct * 100) / total];
}

/** Grupa PTG 2008; null dla punktow w szczelinach tabeli (granice PTG nie domykaja sie wszedzie). */
export function ptgTextureClass(texture: TextureFractions): PtgTextureClass | null {
  const [s, si, c] = normalized(texture);

  return RULES.find(([, rule]) => rule(s, si, c))?.[0] ?? null;
}

/**
 * Zapas, gdy punkt nie trafia w zadna grupe: udzial czesci splawialnych (< 0,02 mm, stara klasyfikacja)
 * szacowany log-liniowo z frakcji USDA (il + 0,715 pylu), progi kategorii agronomicznych 10 / 20 / 35%.
 */
function categoryFromFineParticles(texture: TextureFractions): SoilCategory {
  const [, si, c] = normalized(texture);
  const fine = c + si * (Math.log(10) / Math.log(25));

  if (fine <= 10) return 1;

  if (fine <= 20) return 2;

  return fine <= 35 ? 3 : 4;
}

export function iungCategoryFromTexture(texture: TextureFractions): {
  category: SoilCategory;
  textureClass: PtgTextureClass | null;
} {
  const textureClass = ptgTextureClass(texture);

  return {
    category: textureClass ? CATEGORY_OF_CLASS[textureClass] : categoryFromFineParticles(texture),
    textureClass,
  };
}

/** Kategoria z wody dostepnej w profilu do 1,5 m wg granic WOD IUNG (127,5 / 170 / 202,5 mm). */
export function iungCategoryFromWater(availableWaterMm: number): SoilCategory {
  const [first, second, third] = IUNG_WATER_LIMITS_MM;

  if (availableWaterMm < first) return 1;

  if (availableWaterMm < second) return 2;

  return availableWaterMm <= third ? 3 : 4;
}
