// Uzytki gruntowe z ewidencji (klasouzytki EGiB, np. "RIVb", "S-RIIIa", "W/ŁV", "LsV", "dr") pogrupowane do zdania
// dla rolnika: rodzaj uzytku i zakres klas bonitacyjnych ("grunty orne klasy IVb-VI, laka klasy V, row"). Kody
// zostaja w szczegolach dla doradcy; nazwy rodzajow sa w tlumaczeniach (`report.landUse.kinds`). Oznaczenia jak
// w silniku (apps/server/src/domain/land-use) - raport niesie surowe kody, wiec grupujemy je tutaj.
import { LAND_USE_KINDS, type LandUse, type LandUseKind } from '@app/contracts';

/** Oznaczenie uzytku -> rodzaj; dluzsze oznaczenia przed krotszymi (Wsr przed W, Ps przed P). */
const KINDS: readonly (readonly [string, LandUseKind])[] = [
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

/** Klasa bonitacyjna na koncu oznaczenia gruntu rolnego (R, L, Ps; takze po "-" w sadzie: S-RIIIa). */
const SOIL_CLASS = /(?:^|-)(?:R|Ł|Ps)(VIz|VI|V|IVa|IVb|IV|IIIa|IIIb|III|II|I)$/u;

const SOIL_CLASS_ORDER = ['I', 'II', 'IIIa', 'IIIb', 'III', 'IVa', 'IVb', 'IV', 'V', 'VI', 'VIz'] as const;

/** Rodzaje, przy ktorych klasa gleby ma sens dla rolnika (grunty uprawne). */
const CLASSED: ReadonlySet<LandUseKind> = new Set(['arable', 'orchard', 'meadow', 'pasture']);

export interface LandUseGroup {
  kind: LandUseKind;
  /** klasy bonitacyjne tego rodzaju, od najlepszej; puste dla gruntow bez klasy (rowy, las, droga) */
  classes: string[];
}

/** Rodzaj uzytku z oznaczenia: liczy sie czesc przed "/" (row na lace "W/ŁV" to row); nieznane -> `other`. */
export function landUseKindOf(code: string): LandUseKind {
  const main = code.trim().split('/')[0] ?? '';

  return KINDS.find(([prefix]) => main.startsWith(prefix))?.[1] ?? 'other';
}

function soilClassOf(code: string): string | null {
  const main = code.trim().split('/')[0] ?? '';

  return SOIL_CLASS.exec(main)?.[1] ?? null;
}

/** Uzytki pogrupowane po rodzaju (kolejnosc jak w ewidencji: uprawne, rolne pozostale, nierolne) z klasami gleby. */
export function landUseGroups(codes: readonly string[]): LandUseGroup[] {
  const classes = new Map<LandUseKind, Set<string>>();

  for (const code of codes) {
    const kind = landUseKindOf(code);
    const found = classes.get(kind) ?? new Set<string>();
    const soilClass = CLASSED.has(kind) ? soilClassOf(code) : null;

    if (soilClass) found.add(soilClass);
    classes.set(kind, found);
  }

  return LAND_USE_KINDS.filter((kind) => classes.has(kind)).map((kind) => ({
    kind,
    classes: SOIL_CLASS_ORDER.filter((soilClass) => classes.get(kind)?.has(soilClass)),
  }));
}

/** Zakres klas do zdania: jedna klasa ("V") albo od najlepszej do najslabszej ("IVb-VI"); null = brak klas. */
export function classRange(classes: readonly string[]): { from: string; to: string } | null {
  const from = classes[0];
  const to = classes.at(-1);

  return from && to ? { from, to } : null;
}

/** Powierzchnia ewidencyjna dzialki (ha) z pola albo z opisu uzytku; null = ewidencja jej nie podala. */
export function registryArea(report: {
  field: { registryAreaHa?: number };
  landUse?: LandUse;
}): number | null {
  return report.field.registryAreaHa ?? report.landUse?.registryAreaHa ?? null;
}
