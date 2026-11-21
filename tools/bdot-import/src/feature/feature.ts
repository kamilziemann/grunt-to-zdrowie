// Zamiana wiersza pliku BDOT10k na rekord tabeli `bdot_hydro`: klasyfikacja, uproszczenie geometrii, zapis EWKB.
// Wiersz przychodzi z czytnika Parquet z geometria juz rozkodowana do postaci GeoJSON (wspolrzedne w EPSG:2180).
import { toEwkbHex, type HydroGeometry } from '../ewkb';
import { BDOT_SRID, type HydroKind, type HydroLayer } from '../layers';
import { simplifyLine, simplifyRing, type Position } from '../simplify';

export interface HydroRecord {
  /** rodzaj obiektu (kody: HYDRO_KIND) */
  k: HydroKind;
  /** nazwa wlasna, gdy obiekt ja ma (rzeki, kanaly, jeziora) */
  n: string | null;
  /** geometria EWKB szesnastkowo */
  g: string;
}

const isPosition = (value: unknown): value is Position =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';

const isLine = (value: unknown): value is Position[] => Array.isArray(value) && value.every(isPosition);

const isLines = (value: unknown): value is Position[][] => Array.isArray(value) && value.every(isLine);

const isPolygons = (value: unknown): value is Position[][][] => Array.isArray(value) && value.every(isLines);

/** Geometria z czytnika (GeoJSON) po uproszczeniu albo null, gdy typ jest nieobslugiwany lub pusty. */
export function simplifyGeometry(value: unknown, toleranceM: number): HydroGeometry | null {
  if (typeof value !== 'object' || value === null || !('type' in value) || !('coordinates' in value))
    return null;

  const { type, coordinates } = value;

  if (type === 'LineString' && isLine(coordinates) && coordinates.length >= 2) {
    return { type, coordinates: simplifyLine(coordinates, toleranceM) };
  }

  if (type === 'MultiLineString' && isLines(coordinates) && coordinates.length > 0) {
    return { type, coordinates: coordinates.map((line) => simplifyLine(line, toleranceM)) };
  }

  if (type === 'Polygon' && isLines(coordinates) && coordinates.length > 0) {
    return { type, coordinates: coordinates.map((ring) => simplifyRing(ring, toleranceM)) };
  }

  if (type === 'MultiPolygon' && isPolygons(coordinates) && coordinates.length > 0) {
    return {
      type,
      coordinates: coordinates.map((polygon) => polygon.map((ring) => simplifyRing(ring, toleranceM))),
    };
  }

  return null;
}

/** Rekord do zapisu albo null, gdy obiekt pomijamy (pod ziemia, morze, zla geometria). */
export function toHydroRecord(
  layer: HydroLayer,
  row: Readonly<Record<string, unknown>>,
  toleranceM: number,
): HydroRecord | null {
  const kind = layer.classify(row);

  if (kind === null) return null;

  const geometry = simplifyGeometry(row.GEOM, toleranceM);

  if (geometry === null) return null;

  const name =
    layer.hasName && typeof row.NAZWA === 'string' && row.NAZWA.trim() !== '' ? row.NAZWA.trim() : null;

  return { k: kind, n: name, g: toEwkbHex(geometry, BDOT_SRID) };
}
