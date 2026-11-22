// Trzy pola wzorcowe do testow silnika analizy (plan silnika analizy): zwykle pole 5 ha,
// waski pas 30 m x 3 km i mala dzialka 0,1 ha w miescie. Geometrie sa syntetyczne (prostokaty), identyfikatory
// maja poprawny format TERYT, ale nie wskazuja prawdziwych dzialek.
import type { ParcelOutlineSource } from '../../src/domain/parcel-outline-source';
import type { ParcelRecord, ParcelSource } from '../../src/domain/parcel-source';

const METERS_PER_DEG_LAT = 111_270;

/** Prostokat o bokach w metrach z lewym dolnym rogiem w (lng, lat). */
function rectangle(lng: number, lat: number, widthM: number, heightM: number): ParcelRecord['geometry'] {
  const dx = widthM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const dy = heightM / METERS_PER_DEG_LAT;
  const fix = (value: number) => Number(value.toFixed(7));

  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng, lat],
        [fix(lng + dx), lat],
        [fix(lng + dx), fix(lat + dy)],
        [lng, fix(lat + dy)],
        [lng, lat],
      ],
    ],
  };
}

export const REGULAR_FIELD: ParcelRecord = {
  id: '040302_2.0011.154/2',
  number: '154/2',
  region: 'Kruszyn',
  commune: 'Sicienko',
  county: 'powiat bydgoski',
  voivodeship: 'kujawsko-pomorskie',
  geometry: rectangle(17.9, 53.05, 250, 200),
  origin: 'uldk',
};

export const NARROW_FIELD: ParcelRecord = {
  id: '120612_2.0007.411',
  number: '411',
  region: 'Zagórze',
  commune: 'Niepołomice',
  county: 'powiat wielicki',
  voivodeship: 'małopolskie',
  geometry: rectangle(20.25, 50.02, 30, 3000),
  origin: 'uldk',
};

export const URBAN_FIELD: ParcelRecord = {
  id: '141201_1.0001.6510/2',
  number: '6510/2',
  region: 'Mińsk Mazowiecki',
  commune: 'Mińsk Mazowiecki',
  county: '',
  voivodeship: 'mazowieckie',
  geometry: rectangle(21.59, 52.172, 25, 40),
  origin: 'egib-wfs',
};

export const REFERENCE_FIELDS: readonly ParcelRecord[] = [REGULAR_FIELD, NARROW_FIELD, URBAN_FIELD];

/** Zrodlo dzialek w pamieci z polami wzorcowymi (zamiast ULDK / WFS). */
export const referenceParcelSource: ParcelSource = {
  byId: (id) => Promise.resolve(REFERENCE_FIELDS.find((field) => field.id === id) ?? null),
  byPoint: () => Promise.resolve(null),
  byName: () => Promise.resolve({ total: 0, items: [] }),
};

export const emptyOutlineSource: ParcelOutlineSource = {
  inBounds: () => Promise.resolve({ truncated: false, items: [] }),
};
