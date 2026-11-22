// Klasouzytki z ewidencji gruntow (EGiB) czytane na potrzeby kroku "Czy to Twoja dzialka?": czy dzialka jest gruntem
// rolnym, a jesli nie - czym jest (las, zabudowa albo droga, woda). Tylko gdy zrodlo podaje uzytki (WFS EGiB).

export type NonFarmKind = 'forest' | 'built' | 'water';

// grunty rolne: orne (R), laki (L), pastwiska (Ps), sady (S-...), zabudowane rolne (Br), pod stawami (Wsr),
// pod rowami (W), zadrzewione na uzytkach rolnych (Lzr)
const FARM = /^(R|Ł|Ps|S-|S$|Br|Wsr|W-|W$|Lzr)/;
const FOREST = /^(Ls|Lz)(?!r)/;
const WATER = /^(Wm|Wp|Ws)(?!r)/;
const BUILT = /^(Ba|Bi|Bp|Bz|B$|B-|K|dr|Tk|Ti|Tp)/;

/**
 * Rodzaje nierolne, gdy ewidencja nie ma na dzialce zadnego uzytku rolnego; pusta lista = grunt rolny albo brak
 * danych (wtedy niczego nie podpowiadamy).
 */
export function nonFarmKinds(landUse: readonly string[] | undefined): NonFarmKind[] {
  if (!landUse || landUse.length === 0 || landUse.some((code) => FARM.test(code))) return [];

  const kinds = new Set<NonFarmKind>();

  for (const code of landUse) {
    if (FOREST.test(code)) kinds.add('forest');
    else if (WATER.test(code)) kinds.add('water');
    else if (BUILT.test(code)) kinds.add('built');
  }

  return [...kinds];
}
