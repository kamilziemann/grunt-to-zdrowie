// Pole analizy (FieldArea) z dzialek albo z geometrii wskazanej przez uzytkownika: powierzchnia, srodek, zasieg
// i stabilny identyfikator (skladnik klucza raportu). Silnik analizy zna tylko pole, nie dzialki.
import type { FieldArea, Parcel, ParcelGeometry } from '@app/contracts';

import { areaSquareMeters, boundingBox, centroid } from '../parcel-geometry';

const SQUARE_METERS_PER_HECTARE = 10_000;
const LABEL_PARCELS = 3;

/** Skrot FNV-1a (32 bity, szesnastkowo) - stabilny identyfikator z tekstu, bez kryptografii. */
export function shortHash(text: string): string {
  let hash = 0x81_1c_9d_c5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function measure(geometry: ParcelGeometry): Pick<FieldArea, 'areaHa' | 'bbox' | 'centroid'> {
  const [lng, lat] = centroid(geometry);

  return {
    areaHa: Math.round(areaSquareMeters(geometry)) / SQUARE_METERS_PER_HECTARE,
    bbox: boundingBox(geometry),
    centroid: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
  };
}

function polygonsOf(geometry: ParcelGeometry): [number, number][][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Pole z jednej albo kilku dzialek ewidencyjnych (kilka dzialek = jedno pole o geometrii wieloczesciowej). */
export function fieldFromParcels(parcels: readonly Parcel[]): FieldArea {
  const [first, ...rest] = parcels;

  if (!first) throw new Error('Pole wymaga co najmniej jednej dzialki');

  const geometry: ParcelGeometry =
    rest.length === 0
      ? first.geometry
      : { type: 'MultiPolygon', coordinates: parcels.flatMap((parcel) => polygonsOf(parcel.geometry)) };
  const ids = parcels.map((parcel) => parcel.id);
  const numbers = parcels.slice(0, LABEL_PARCELS).map((parcel) => parcel.number);
  const more = parcels.length > LABEL_PARCELS ? ` +${parcels.length - LABEL_PARCELS}` : '';

  return {
    id: `parcels:${shortHash(ids.toSorted().join('|'))}`,
    kind: rest.length === 0 ? 'parcel' : 'parcels',
    parcelIds: ids,
    // numery i obreb; slowo "dzialka" doklada interfejs w jezyku uzytkownika
    label: `${numbers.join(', ')}${more} · ${first.region}`,
    geometry,
    ...measure(geometry),
  };
}

/** Pole z geometrii uzytkownika: fragment dzialki (`part`) albo obszar narysowany (`drawn`). */
export function fieldFromGeometry(input: {
  geometry: ParcelGeometry;
  kind: 'part' | 'drawn';
  label?: string | undefined;
  parcelIds: readonly string[];
}): FieldArea {
  return {
    id: `area:${shortHash(JSON.stringify(input.geometry.coordinates))}`,
    kind: input.kind,
    parcelIds: [...input.parcelIds],
    label: input.label ?? '',
    geometry: input.geometry,
    ...measure(input.geometry),
  };
}
