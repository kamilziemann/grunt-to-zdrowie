// Otoczenie pola z wierszy BDOT10k (tabele bdot_cover, bdot_waterworks, bdot_protected; kody `kind` z
// tools/bdot-import/README.md): drzewa przy granicy, budowle i waly w promieniu kilku km, zrodla, ujecia, styk rowu
// z rura, obszary chronione. Brak obiektu w promieniu to wynik ("brak jazu w 3 km"), nie brak danych - brak danych
// zglasza adapter (status `missing`). Port i adapter: infrastructure/surroundings-postgis.
import type {
  FieldTrees,
  FieldWaterworks,
  ProtectedArea,
  ProtectedAreaKind,
  Surroundings,
  WaterStructureKind,
} from '@app/contracts';

import type { LngLat } from '../analysis-ports';

/** Promienie zapytan - stale, bo promien zalezny od wiersza wylacza indeks przestrzenny. */
export const SURROUNDINGS_RADII = {
  /** pas wzdluz granicy, w ktorym drzewa oslaniaja pole */
  treeBandM: 15,
  /** szukanie lasu i rzedow drzew */
  treesM: 500,
  /** budowle, waly, zrodla, ujecia, odcinki w rurach */
  waterworksM: 3000,
  /** styk otwartego rowu z odcinkiem w rurze */
  junctionM: 500,
} as const;

/** granica z drzewami ponizej tego udzialu = pole otwarte na wiatr */
export const OPEN_TO_WIND_SHARE = 0.25;

export const COVER_KINDS = {
  forest: [20, 21, 22],
  treeRow: [23, 24],
} as const;

export const STRUCTURE_KINDS: Readonly<Record<number, WaterStructureKind>> = {
  30: 'weir',
  31: 'dam',
  32: 'lock',
};

export const WATERWORKS_CODES = { intake: 33, spring: 34, levee: 40, piped: [41, 42, 43] } as const;

export const PROTECTED_KINDS: Readonly<Record<number, ProtectedAreaKind>> = {
  50: 'natura2000',
  51: 'landscape_park',
  52: 'national_park',
  53: 'nature_reserve',
};

/** Podsumowanie jednego kodu `kind` w promieniu (drzewa albo siec wodna). */
export interface KindSummaryRow {
  kind: number;
  features: number;
  nearestM: number;
  nearestName: string | null;
}

export interface SurroundingsRows {
  cover: readonly KindSummaryRow[];
  /** dlugosc granicy pola i jej czesci w pasie drzew (m) */
  edge: { edgeM: number; woodedEdgeM: number; woodedAreaShare?: number };
  waterworks: readonly KindSummaryRow[];
  /** najblizszy styk otwartego rowu z rura; null = brak w promieniu */
  junction: { distanceM: number; point: LngLat } | null;
  protectedAreas: readonly { kind: number; name: string | null }[];
}

const round = (value: number): number => Math.round(value);

function nearestOf(rows: readonly KindSummaryRow[], kinds: readonly number[]): KindSummaryRow | null {
  return (
    rows
      .filter((row) => kinds.includes(row.kind))
      .toSorted((a, b) => a.nearestM - b.nearestM)
      .at(0) ?? null
  );
}

const countOf = (rows: readonly KindSummaryRow[], kinds: readonly number[]): number =>
  rows.filter((row) => kinds.includes(row.kind)).reduce((sum, row) => sum + row.features, 0);

export function treesFromRows(cover: readonly KindSummaryRow[], edge: SurroundingsRows['edge']): FieldTrees {
  const forest = nearestOf(cover, COVER_KINDS.forest);
  const treeRow = nearestOf(cover, COVER_KINDS.treeRow);
  // pas 15 m wokol drzew moze objac granice z obu stron rogu - udzial nie przekracza 1
  const woodedEdgeM = Math.min(edge.woodedEdgeM, edge.edgeM);
  const share = edge.edgeM > 0 ? woodedEdgeM / edge.edgeM : 0;

  return {
    bandM: SURROUNDINGS_RADII.treeBandM,
    edgeM: round(edge.edgeM),
    woodedEdgeM: round(woodedEdgeM),
    woodedEdgeShare: Number(share.toFixed(2)),
    ...(edge.woodedAreaShare === undefined
      ? {}
      : { woodedAreaShare: Number(Math.min(Math.max(edge.woodedAreaShare, 0), 1).toFixed(2)) }),
    nearestForestM: forest ? round(forest.nearestM) : null,
    nearestTreeRowM: treeRow ? round(treeRow.nearestM) : null,
    searchRadiusM: SURROUNDINGS_RADII.treesM,
    openToWind: share < OPEN_TO_WIND_SHARE,
  };
}

export function waterworksFromRows(
  rows: readonly KindSummaryRow[],
  junction: SurroundingsRows['junction'],
): FieldWaterworks {
  const structureCodes = Object.keys(STRUCTURE_KINDS).map(Number);
  const structure = nearestOf(rows, structureCodes);
  const structureKind = structure ? STRUCTURE_KINDS[structure.kind] : undefined;
  const levee = nearestOf(rows, [WATERWORKS_CODES.levee]);
  const spring = nearestOf(rows, [WATERWORKS_CODES.spring]);
  const intake = nearestOf(rows, [WATERWORKS_CODES.intake]);

  return {
    searchRadiusM: SURROUNDINGS_RADII.waterworksM,
    nearestStructure:
      structure && structureKind
        ? { kind: structureKind, distanceM: round(structure.nearestM), name: structure.nearestName }
        : null,
    structures: countOf(rows, structureCodes),
    levees: countOf(rows, [WATERWORKS_CODES.levee]),
    nearestLeveeM: levee ? round(levee.nearestM) : null,
    nearestSpring: spring ? { distanceM: round(spring.nearestM), name: spring.nearestName } : null,
    nearestIntakeM: intake ? round(intake.nearestM) : null,
    pipedSegments: countOf(rows, WATERWORKS_CODES.piped),
    pipedJunction: junction
      ? {
          distanceM: round(junction.distanceM),
          point: [Number(junction.point[0].toFixed(6)), Number(junction.point[1].toFixed(6))],
        }
      : null,
    junctionRadiusM: SURROUNDINGS_RADII.junctionM,
  };
}

/** Obszar to wiele wierszy o tej samej nazwie (pociete granice) - jeden wpis na rodzaj i nazwe, od najsilniejszej ochrony. */
export function protectedAreasFromRows(rows: SurroundingsRows['protectedAreas']): ProtectedArea[] {
  const strength: Record<ProtectedAreaKind, number> = {
    national_park: 0,
    nature_reserve: 1,
    natura2000: 2,
    landscape_park: 3,
  };
  const seen = new Map<string, ProtectedArea>();

  for (const row of rows) {
    const kind = PROTECTED_KINDS[row.kind];
    const name = row.name?.trim();

    if (!kind || !name) continue;

    seen.set(`${kind}:${name}`, { kind, name });
  }

  return [...seen.values()].toSorted(
    (a, b) => strength[a.kind] - strength[b.kind] || a.name.localeCompare(b.name, 'pl'),
  );
}

export function surroundingsFromRows(rows: SurroundingsRows): Surroundings {
  return {
    trees: treesFromRows(rows.cover, rows.edge),
    water: waterworksFromRows(rows.waterworks, rows.junction),
    protectedAreas: protectedAreasFromRows(rows.protectedAreas),
  };
}
