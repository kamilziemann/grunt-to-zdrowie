// Adapter ParcelOutlineSource na zbiorcza usluge WFS ewidencji gruntow i budynkow GUGiK (warstwa `ms:dzialki`).
// Usluga oddaje GeoJSON w WGS84 [dlugosc, szerokosc]; prostokat zapytania dla `urn:...:EPSG::4326` ma kolejnosc
// szerokosc, dlugosc. Bez naglowkow CORS, wiec przegladarka pyta nasze API, a ono ten adapter.
import { AppError } from '@app/http';

import {
  containsPoint,
  type BoundingBox,
  type PolygonGeometry,
  type Position,
} from '../../domain/parcel-geometry';
import type {
  ParcelOutlineRecord,
  ParcelOutlines,
  ParcelOutlineSource,
} from '../../domain/parcel-outline-source';
import { parseLandUseCodes } from '../../domain/land-use';
import type {
  ParcelRecord,
  ParcelRegistry,
  ParcelRegistryEntry,
  ParcelSource,
} from '../../domain/parcel-source';

export const EGIB_WFS_URL = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza';

const TIMEOUT_MS = 15_000;
/** Limit obiektow na zapytanie: kafel siatki w gestej zabudowie ma kilkaset dzialek. */
const MAX_FEATURES = 3000;
/** 6 miejsc po przecinku to ok. 10 cm - dokladniej niz dane, a odpowiedz jest o polowe mniejsza. */
const COORDINATE_DECIMALS = 6;

export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

interface WfsFeature {
  properties?: {
    ID_DZIALKI?: unknown;
    NUMER_DZIALKI?: unknown;
    NAZWA_OBREBU?: unknown;
    NAZWA_GMINY?: unknown;
    /** powierzchnia ewidencyjna w ha jako tekst ("0.2655"); literowka w nazwie pochodzi z uslugi */
    POLE_EWIDENYJNE?: unknown;
    /** klasouzytki po przecinku, np. "RIVb,RV,ŁV" */
    KLASOUZYTKI_EGIB?: unknown;
  } | null;
  geometry?: { type?: unknown; coordinates?: unknown } | null;
}

function round(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

function isRings(value: unknown): value is number[][][] {
  return (
    Array.isArray(value) &&
    value.every(
      (ring) => Array.isArray(ring) && ring.every((point) => Array.isArray(point) && point.length >= 2),
    )
  );
}

function toRings(rings: number[][][]): Position[][] {
  return rings.map((ring) => ring.map((point): Position => [round(point[0] ?? 0), round(point[1] ?? 0)]));
}

function toGeometry(geometry: WfsFeature['geometry']): PolygonGeometry | null {
  if (geometry?.type === 'Polygon' && isRings(geometry.coordinates)) {
    return { type: 'Polygon', coordinates: toRings(geometry.coordinates) };
  }

  if (
    geometry?.type === 'MultiPolygon' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.every(isRings)
  ) {
    return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(toRings) };
  }

  return null;
}

/** Odpowiedz GetFeature (GeoJSON) -> obrysy; obiekty bez identyfikatora albo z inna geometria pomijamy. */
export function parseOutlines(body: unknown): ParcelOutlineRecord[] {
  const features: unknown = (body as { features?: unknown } | null)?.features;

  if (!Array.isArray(features)) throw new Error('EGiB WFS response has no features array');

  return (features as WfsFeature[]).flatMap((feature) => {
    const id = feature.properties?.ID_DZIALKI;
    const number = feature.properties?.NUMER_DZIALKI;
    const geometry = toGeometry(feature.geometry);

    if (typeof id !== 'string' || id === '' || !geometry) return [];

    return [{ id, number: typeof number === 'string' ? number : '', geometry }];
  });
}

export function createEgibWfsOutlineSource(
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): ParcelOutlineSource {
  return {
    async inBounds([west, south, east, north]: BoundingBox): Promise<ParcelOutlines> {
      const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAMES: 'ms:dzialki',
        SRSNAME: 'EPSG:4326',
        OUTPUTFORMAT: 'application/json',
        COUNT: String(MAX_FEATURES),
        BBOX: `${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326`,
      });

      try {
        const response = await fetchImpl(`${EGIB_WFS_URL}?${params.toString()}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) throw new Error(`EGiB WFS responded with HTTP ${response.status}`);

        const items = parseOutlines(await response.json());

        return { items, truncated: items.length >= MAX_FEATURES };
      } catch (error) {
        throw AppError.upstream('EGiB WFS', error);
      }
    },
  };
}

/** Wojewodztwo z dwoch pierwszych cyfr identyfikatora TERYT (WFS nie podaje nazwy wojewodztwa ani powiatu). */
const VOIVODESHIPS: Record<string, string> = {
  '02': 'dolnośląskie',
  '04': 'kujawsko-pomorskie',
  '06': 'lubelskie',
  '08': 'lubuskie',
  '10': 'łódzkie',
  '12': 'małopolskie',
  '14': 'mazowieckie',
  '16': 'opolskie',
  '18': 'podkarpackie',
  '20': 'podlaskie',
  '22': 'pomorskie',
  '24': 'śląskie',
  '26': 'świętokrzyskie',
  '28': 'warmińsko-mazurskie',
  '30': 'wielkopolskie',
  '32': 'zachodniopomorskie',
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** WFS podaje nazwe obrebu wersalikami ("MIŃSK MAZOWIECKI") - oddajemy ja jak ULDK: "Mińsk Mazowiecki". */
function titleCase(value: string): string {
  return value
    .toLocaleLowerCase('pl')
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_match, lead: string, letter: string) => lead + letter.toLocaleUpperCase('pl'),
    );
}

/** Klasouzytki i powierzchnia ewidencyjna z atrybutow obiektu; puste pola pomijamy. */
function registryOf(properties: WfsFeature['properties']): Partial<ParcelRegistryEntry> {
  const landUse = parseLandUseCodes(text(properties?.KLASOUZYTKI_EGIB));
  const area = Number.parseFloat(text(properties?.POLE_EWIDENYJNE).replace(',', '.'));

  return {
    ...(landUse.length > 0 ? { landUse } : {}),
    ...(Number.isFinite(area) && area > 0 ? { registryAreaHa: area } : {}),
  };
}

/** Obiekty GetFeature -> pelne rekordy dzialek (opis w zakresie, jaki niesie WFS: bez powiatu). */
export function parseParcels(body: unknown): ParcelRecord[] {
  const features: unknown = (body as { features?: unknown } | null)?.features;

  if (!Array.isArray(features)) throw new Error('EGiB WFS response has no features array');

  return (features as WfsFeature[]).flatMap((feature): ParcelRecord[] => {
    const id = text(feature.properties?.ID_DZIALKI);
    const geometry = toGeometry(feature.geometry);

    if (id === '' || !geometry) return [];

    return [
      {
        id,
        number: text(feature.properties?.NUMER_DZIALKI),
        region: titleCase(text(feature.properties?.NAZWA_OBREBU)),
        commune: text(feature.properties?.NAZWA_GMINY),
        county: '',
        voivodeship: VOIVODESHIPS[id.slice(0, 2)] ?? '',
        geometry,
        origin: 'egib-wfs',
        ...registryOf(feature.properties),
      },
    ];
  });
}

/** Polowa boku prostokata zapytania o punkt (ok. 0,1 m) - WFS nie ma zapytania "dzialka pod punktem". */
const POINT_EPSILON = 0.000_001;

/**
 * Zapasowe zrodlo dzialek na tej samej usludze WFS: po identyfikatorze (filtr) i pod punktem (maly prostokat +
 * sprawdzenie, w ktorej dzialce lezy punkt). Szukania po nazwie obrebu WFS nie ma.
 */
export function createEgibWfsParcelSource(
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): ParcelSource {
  async function query(extra: Record<string, string>): Promise<ParcelRecord[]> {
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: 'ms:dzialki',
      SRSNAME: 'EPSG:4326',
      OUTPUTFORMAT: 'application/json',
      ...extra,
    });

    try {
      const response = await fetchImpl(`${EGIB_WFS_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) throw new Error(`EGiB WFS responded with HTTP ${response.status}`);

      return parseParcels(await response.json());
    } catch (error) {
      throw AppError.upstream('EGiB WFS', error);
    }
  }

  return {
    async byId(id) {
      // identyfikator przeszedl walidacje wzorcem (cyfry, litery, ". _ / -"), wiec nie wymaga kodowania XML
      const filter =
        '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo>' +
        `<fes:ValueReference>ID_DZIALKI</fes:ValueReference><fes:Literal>${id}</fes:Literal>` +
        '</fes:PropertyIsEqualTo></fes:Filter>';
      const found = await query({ FILTER: filter });

      return found.find((parcel) => parcel.id === id) ?? null;
    },

    async byPoint(lng, lat) {
      const found = await query({
        BBOX: `${lat - POINT_EPSILON},${lng - POINT_EPSILON},${lat + POINT_EPSILON},${lng + POINT_EPSILON},urn:ogc:def:crs:EPSG::4326`,
      });

      return found.find((parcel) => containsPoint(parcel.geometry, [lng, lat])) ?? found[0] ?? null;
    },

    byName: () => Promise.reject(AppError.upstream('EGiB WFS', new Error('name search is not supported'))),
  };
}

/** Ewidencja (klasouzytki, powierzchnia) po identyfikatorze - uzupelnia dzialke z ULDK, ktore tych danych nie ma. */
export function createEgibWfsRegistry(source: ParcelSource = createEgibWfsParcelSource()): ParcelRegistry {
  return {
    async byId(id) {
      const record = await source.byId(id);

      if (!record?.landUse) return null;

      return {
        landUse: record.landUse,
        ...(record.registryAreaHa === undefined ? {} : { registryAreaHa: record.registryAreaHa }),
      };
    },
  };
}
