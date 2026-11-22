// Uzytki gruntowe z ewidencji (klasouzytki EGiB, np. "RIVb", "S-RIIIa", "W/ŁV", "LsV", "dr") -> co to za grunt
// i jakie klasy bonitacyjne maja grunty rolne. Oznaczenia wg rozporzadzenia w sprawie ewidencji gruntow i budynkow
// (zal. 6: uzytki gruntowe) i klasyfikacji gleboznawczej (klasy I-VI). Ewidencja nie podaje powierzchni klasouzytkow
// w tej usludze, wiec mowimy tylko, jakie sa - nie ile ich jest.
import type { CropId, LandUse, LandUseKind } from '@app/contracts';

/** Oznaczenie uzytku -> rodzaj; dluzsze oznaczenia przed krotszymi (Wsr przed W, Ps przed P). */
const KINDS: readonly [string, LandUseKind][] = [
  ['Wsr', 'ponds'],
  ['Lzr', 'farm_woodland'],
  ['Br', 'farm_buildings'],
  ['Ps', 'pasture'],
  ['Ls', 'forest'],
  ['Lz', 'woodland'],
  ['Ba', 'built'],
  ['Bi', 'built'],
  ['Bp', 'built'],
  ['Bz', 'built'],
  ['Wm', 'water'],
  ['Wp', 'water'],
  ['Ws', 'water'],
  ['Tk', 'railway'],
  ['Ti', 'road'],
  ['Tp', 'road'],
  ['Tr', 'other'],
  ['dr', 'road'],
  ['R', 'arable'],
  ['S', 'orchard'],
  ['Ł', 'meadow'],
  ['W', 'ditches'],
  ['B', 'built'],
  ['K', 'other'],
  ['N', 'wasteland'],
];

/** Grunty, na ktorych rosnie uprawa: orne, sady, laki i pastwiska trwale (z pochodnymi, np. S-R, W/Ł nie). */
const FARMLAND: ReadonlySet<LandUseKind> = new Set(['arable', 'orchard', 'meadow', 'pasture']);
const GRASSLAND: ReadonlySet<LandUseKind> = new Set(['meadow', 'pasture']);

/** Klasa bonitacyjna gruntu rolnego (R, L, Ps) w oznaczeniu; kolejnosc: dluzsze przed krotszymi. */
const SOIL_CLASS = /(?:^|[-/])(?:R|Ł|Ps)(VIz|VI|V|IVa|IVb|IV|IIIa|IIIb|III|II|I)$/u;

export const SOIL_CLASS_ORDER = [
  'I',
  'II',
  'IIIa',
  'IIIb',
  'III',
  'IVa',
  'IVb',
  'IV',
  'V',
  'VI',
  'VIz',
] as const;

/** Klasa jako liczba 1-6 (IIIa, IIIb -> 3; VIz -> 6) - do dowodu w raporcie i regul kategorii gleby. */
export function soilClassNumber(soilClass: string): number | null {
  const roman = soilClass.replace(/[ab]$|z$/u, '');
  const value = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }[roman];

  return value ?? null;
}

/** Rodzaj uzytku z jednego oznaczenia; nieznane oznaczenie -> `other`. */
export function landUseKind(code: string): LandUseKind {
  const main = code.trim().split(/[-/]/u)[0] ?? '';

  return KINDS.find(([prefix]) => main.startsWith(prefix))?.[1] ?? 'other';
}

/** Klasy bonitacyjne gruntow rolnych z oznaczen (unikalne, od najlepszej). */
export function soilClassesOf(codes: readonly string[]): string[] {
  const found = new Set<string>();

  for (const code of codes) {
    const match = SOIL_CLASS.exec(code.trim());

    if (match?.[1]) found.add(match[1]);
  }

  return SOIL_CLASS_ORDER.filter((soilClass) => found.has(soilClass));
}

/** Czy choc jeden uzytek to grunt uprawny (R, S, L, Ps). */
export function hasFarmland(codes: readonly string[]): boolean {
  return codes.some((code) => FARMLAND.has(landUseKind(code)));
}

/** od tego udzialu lasu w powierzchni pola (BDOT10k) uznajemy, ze dzialka to raczej las niz pole */
export const LIKELY_FOREST_SHARE = 0.5;

/**
 * Czym dzialka moze byc, gdy ewidencja nie podala uzytku (np. powiaty Lubelszczyzny i Podkarpacia): `forest` - ponad
 * polowa pola lezy pod lasem wg BDOT10k; `no_soil` - mapa glebowa nie ma gleby w polu (zabudowa, woda), wzieto ja z
 * poblizu. Null = ewidencja zna uzytek albo nic nie wskazuje, ze to nie pole.
 */
export function landCoverGuess(
  landUse: readonly string[] | undefined,
  hints: { woodedAreaShare?: number | undefined; soilSubstituted: boolean },
): 'forest' | 'no_soil' | null {
  if (landUse && landUse.length > 0) return null;

  if ((hints.woodedAreaShare ?? 0) >= LIKELY_FOREST_SHARE) return 'forest';

  return hints.soilSubstituted ? 'no_soil' : null;
}

/** Klasouzytki z ewidencji jako lista oznaczen ("RIVb,RV, ŁV" -> ["RIVb", "RV", "ŁV"]). */
/**
 * Czy pole nie jest gruntem rolnym: ewidencja zna uzytek i nie ma w nim gruntu uprawnego albo - gdy ewidencja milczy -
 * inne dane wskazuja las lub teren bez gleby. Wtedy raport nie podaje zabiegow polowych, nawadniania ani budowy
 * urzadzen wodnych, a "wrazliwosc uprawy" nie jest przyczyna.
 */
export function isNotFarmland(
  landUse: readonly string[] | undefined,
  hints: { woodedAreaShare?: number | undefined; soilSubstituted: boolean },
): boolean {
  if (landUse && landUse.length > 0) return !hasFarmland(landUse);

  return landCoverGuess(landUse, hints) !== null;
}

export function parseLandUseCodes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code !== ''),
    ),
  ];
}

/**
 * Opis uzytku do raportu. `mismatch`: ewidencja mowi o gruncie nierolnym (ocena dotyczy warunkow w okolicy) albo
 * o samych lakach i pastwiskach przy uprawie polowej. `cropHint` podpowiada uzytki zielone, gdy sa laki/pastwiska.
 */
export function summarizeLandUse(
  codes: readonly string[] | undefined,
  cropId: CropId,
  registryAreaHa?: number,
): LandUse | null {
  if (!codes || codes.length === 0) return null;

  const kinds = [...new Set(codes.map(landUseKind))];
  const farmland = kinds.filter((kind) => FARMLAND.has(kind));
  const grassland = farmland.some((kind) => GRASSLAND.has(kind));
  const grasslandOnly = farmland.length > 0 && farmland.every((kind) => GRASSLAND.has(kind));
  const fieldCrop = cropId !== 'grassland';

  return {
    codes: [...codes],
    kinds,
    agricultural: farmland.length > 0,
    soilClasses: soilClassesOf(codes),
    cropHint: grassland && fieldCrop ? 'grassland' : null,
    mismatch:
      farmland.length === 0 ? 'non_agricultural' : grasslandOnly && fieldCrop ? 'grassland_only' : null,
    ...(registryAreaHa === undefined ? {} : { registryAreaHa }),
  };
}
