// Woda w otoczeniu pola z wierszy hydrografii BDOT10k (tabela bdot_hydro, kody `kind` z tools/bdot-import):
// odleglosci od granicy pola do najblizszego rowu, cieku, wody stojacej i mokradla w promieniu przeszukania. Brak
// obiektu danego rodzaju w promieniu to wynik ("brak zmapowanego rowu w 500 m"), a nie brak danych - brak danych
// zglasza adapter (status `missing`). Kanal liczymy jako ciek, szerokie koryto rzeki (poligon) - tez.
import type { HydroContext, HydroFeatureKind, LngLat } from '../analysis-ports';

/** Kody `kind` tabeli bdot_hydro -> rodzaj obiektu w raporcie. */
export const BDOT_KINDS: Readonly<Record<number, HydroFeatureKind>> = {
  1: 'ditch',
  2: 'watercourse',
  3: 'watercourse',
  4: 'watercourse',
  5: 'water_body',
  6: 'watercourse',
  7: 'wetland',
  8: 'wetland',
};

/** Podsumowanie jednego kodu `kind` w promieniu przeszukania. */
export interface HydroKindRow {
  kind: number;
  features: number;
  nearestM: number;
  nearestName: string | null;
  /** dlugosc linii wewnatrz pola (m); dla poligonow 0 */
  lengthInFieldM: number;
}

/** Obiekt do mapy: geometria GeoJSON w WGS84 przycieta do promienia. */
export interface HydroFeatureRow {
  kind: number;
  geometry: { type: string; coordinates: unknown };
}

const round = (value: number): number => Math.round(value);

function nearest(rows: readonly HydroKindRow[], kind: HydroFeatureKind): HydroKindRow | null {
  return (
    rows
      .filter((row) => BDOT_KINDS[row.kind] === kind)
      .toSorted((a, b) => a.nearestM - b.nearestM)
      .at(0) ?? null
  );
}

const isPosition = (value: unknown): value is LngLat =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';

/** Linie i pierscienie zewnetrzne z geometrii GeoJSON (Multi* rozbite na czesci). */
function linesOf(geometry: HydroFeatureRow['geometry']): LngLat[][] {
  const { type, coordinates } = geometry;
  const asLine = (value: unknown): LngLat[] => (Array.isArray(value) ? value.filter(isPosition) : []);
  const parts = Array.isArray(coordinates) ? (coordinates as unknown[]) : [];

  switch (type) {
    case 'LineString':
      return [asLine(coordinates)];
    case 'MultiLineString':
      return parts.map(asLine);
    case 'Polygon':
      return [asLine(parts[0])];
    case 'MultiPolygon':
      return parts.map((polygon) => asLine(Array.isArray(polygon) ? polygon[0] : []));
    default:
      return [];
  }
}

export function hydroContextFromRows(
  rows: readonly HydroKindRow[],
  features: readonly HydroFeatureRow[],
  searchRadiusM: number,
): HydroContext {
  const ditch = nearest(rows, 'ditch');
  const watercourse = nearest(rows, 'watercourse');
  const waterBody = nearest(rows, 'water_body');
  const wetland = nearest(rows, 'wetland');
  const count = (kind: HydroFeatureKind) =>
    rows.filter((row) => BDOT_KINDS[row.kind] === kind).reduce((sum, row) => sum + row.features, 0);

  return {
    searchRadiusM,
    nearestWatercourseM: watercourse ? round(watercourse.nearestM) : null,
    nearestDitchM: ditch ? round(ditch.nearestM) : null,
    nearestWaterBodyM: waterBody ? round(waterBody.nearestM) : null,
    nearestWetlandM: wetland ? round(wetland.nearestM) : null,
    waterBodies: count('water_body'),
    wetlands: count('wetland'),
    ditchesInRadius: count('ditch'),
    ditchLengthInFieldM: round(
      rows
        .filter((row) => BDOT_KINDS[row.kind] === 'ditch')
        .reduce((sum, row) => sum + row.lengthInFieldM, 0),
    ),
    nearestWatercourseName: watercourse?.nearestName ?? null,
    features: features.flatMap((feature) => {
      const kind = BDOT_KINDS[feature.kind];

      return kind
        ? linesOf(feature.geometry)
            .filter((line) => line.length >= 2)
            .map((coordinates) => ({ kind, coordinates }))
        : [];
    }),
    // pokrycie terenu (zadrzewienia) wymaga osobnego zrodla (WorldCover) - jeszcze go nie ma
    treeCoverShare: null,
  };
}
