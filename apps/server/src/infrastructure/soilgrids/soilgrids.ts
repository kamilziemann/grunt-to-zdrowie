// Adapter SoilSource na SoilGrids 2.0 (ISRIC, https://docs.isric.org/globaldata/soilgrids/wcs.html): piasek, il
// i wegiel organiczny w szesciu warstwach do 2 m z uslugi WCS (REST ISRIC jest wstrzymany i oddaje puste wartosci).
// Jedno zapytanie = jedna wlasciwosc i warstwa dla prostokata pola; pyl to reszta do 100%. Wartosci usredniamy po
// pikselach, ktorych srodek lezy w polu (male pole: wszystkie piksele prostokata). SoilGrids to globalny model
// uczenia maszynowego w siatce 250 m, a nie mapa glebowo-rolnicza - SourceRef mowi to wprost, a kategoria gleby
// dostaje zakres (domain/soil-profile). Zero we wszystkich frakcjach = brak predykcji (zabudowa, woda) - wtedy drugi
// odczyt z marginesem 2 km i gleba z najblizszych pikseli z predykcja (pierscienie 500 m, 1 km, 2 km), jako `partial`.
import type { FieldArea, SourceRef } from '@app/contracts';

import type { SoilProfile, SoilSource, Sourced } from '../../domain/analysis-ports';
import { containsPoint } from '../../domain/parcel-geometry';
import { soilProfileFromLayers, type SoilLayer } from '../../domain/soil-profile';
import { readGeoTiff, type Raster } from '../geotiff';
import { failureNote, httpFailureNote } from '../../lib/source-note';
import { STATIC_TTL_S } from '../../domain/source-cache-policy';

export const SOILGRIDS_WCS_URL = 'https://maps.isric.org/mapserv';

const PROVIDER = 'ISRIC SoilGrids 2.0 (globalny model uziarnienia, 250 m - nie mapa glebowo-rolnicza)';
const LICENCE = 'CC BY 4.0 (ISRIC - World Soil Information)';
const RESOLUTION = '250 m (model globalny)';
const TIMEOUT_MS = 6000;
/** ISRIC kolejkuje zapytania jednego klienta: 3-4 naraz konczy sie szybciej niz 18 naraz */
const CONCURRENCY = 4;
/** margines wokol pola (stopnie), zeby nawet male pole trafilo w piksel */
const PAD_DEG = 0.0015;
/** pierscienie szukania gleby zastepczej wokol pola bez predykcji (m od prostokata pola) */
export const SUBSTITUTE_RINGS_M = [500, 1000, 2000] as const;
const METERS_PER_DEG_LAT = 111_320;

export const SOILGRIDS_DEPTHS = [
  { label: '0-5cm', topCm: 0, bottomCm: 5 },
  { label: '5-15cm', topCm: 5, bottomCm: 15 },
  { label: '15-30cm', topCm: 15, bottomCm: 30 },
  { label: '30-60cm', topCm: 30, bottomCm: 60 },
  { label: '60-100cm', topCm: 60, bottomCm: 100 },
  { label: '100-200cm', topCm: 100, bottomCm: 200 },
] as const;

/** Wlasciwosci i dzielnik do jednostek: piasek i il w g/kg (/10 = %), wegiel w dg/kg (/10 = g/kg). */
const PROPERTIES = { sand: 10, clay: 10, soc: 10 } as const;

type Property = keyof typeof PROPERTIES;

export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export interface SoilGridsOptions {
  fetch?: FetchLike;
  now?: () => string;
}

/** Czas zycia odpowiedzi w pamieci: model gleby sie nie zmienia (nowa wersja SoilGrids to nowy adres mapy). */
export const soilGridsCacheTtl = (): number => STATIC_TTL_S;

/** Margines wokol pola w stopniach [dlugosc, szerokosc] dla odleglosci w metrach. */
function padFor(meters: number, latitude: number): [number, number] {
  return [meters / (METERS_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180)), meters / METERS_PER_DEG_LAT];
}

export function coverageUrl(
  property: Property,
  depth: string,
  bbox: FieldArea['bbox'],
  [padX, padY]: [number, number] = [PAD_DEG, PAD_DEG],
): string {
  const [west, south, east, north] = bbox;
  const fixed = (value: number) => value.toFixed(5);

  return (
    `${SOILGRIDS_WCS_URL}?map=/map/${property}.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage` +
    `&COVERAGEID=${property}_${depth}_mean&FORMAT=image/tiff` +
    `&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326` +
    `&SUBSET=long(${fixed(west - padX)},${fixed(east + padX)})` +
    `&SUBSET=lat(${fixed(south - padY)},${fixed(north + padY)})`
  );
}

const pixelCenter = (raster: Raster, index: number): [number, number] => [
  raster.originX + ((index % raster.width) + 0.5) * raster.pixelX,
  raster.originY - (Math.floor(index / raster.width) + 0.5) * raster.pixelY,
];

const allPixels = (raster: Raster): number[] =>
  Array.from({ length: raster.width * raster.height }, (_unused, index) => index);

/** Piksel ma predykcje, gdy piasek albo il nie sa zerem (SoilGrids maskuje zabudowe i wody zerami). */
const predicted = (rasters: Pick<Record<Property, Raster>, 'sand' | 'clay'>, index: number): boolean =>
  (rasters.sand.values[index] ?? 0) > 0 || (rasters.clay.values[index] ?? 0) > 0;

/** Indeksy pikseli, ktorych srodek lezy w polu; gdy zaden (pole mniejsze od piksela) - wszystkie. */
function pixelsInField(raster: Raster, field: FieldArea): number[] {
  const all = allPixels(raster);
  const inside = all.filter((index) => containsPoint(field.geometry, pixelCenter(raster, index)));

  return inside.length > 0 ? inside : all;
}

/** Odleglosc srodka piksela od prostokata pola w metrach (0 = w prostokacie). */
function distanceFromField(raster: Raster, index: number, field: FieldArea): number {
  const [x, y] = pixelCenter(raster, index);
  const [west, south, east, north] = field.bbox;
  const [degX, degY] = padFor(1, field.centroid[1]);
  const dx = Math.max(west - x, 0, x - east) / degX;
  const dy = Math.max(south - y, 0, y - north) / degY;

  return Math.hypot(dx, dy);
}

/**
 * Gleba zastepcza dla pola bez predykcji: piksele z predykcja w najmniejszym pierscieniu wokol pola, w ktorym
 * jakikolwiek jest. Pierscienie sa szerokie celowo - SoilGrids maskuje cale osiedla, a gleba sasiednich pol tego
 * samego krajobrazu jest lepszym przyblizeniem niz "gleba srednia" przyjeta w ciemno.
 */
export function substitutePixels(
  rasters: Pick<Record<Property, Raster>, 'sand' | 'clay'>,
  field: FieldArea,
): { pixels: number[]; distanceM: number } | null {
  const candidates = allPixels(rasters.sand)
    .filter((index) => predicted(rasters, index))
    .map((index) => ({ index, distanceM: distanceFromField(rasters.sand, index, field) }));

  for (const ring of SUBSTITUTE_RINGS_M) {
    const within = candidates.filter((candidate) => candidate.distanceM <= ring);

    if (within.length > 0) {
      return {
        pixels: within.map((candidate) => candidate.index),
        distanceM: Math.min(...within.map((candidate) => candidate.distanceM)),
      };
    }
  }

  return null;
}

/**
 * Usrednia trzy wlasciwosci warstwy po tych samych pikselach (domyslnie: w polu); piksele bez predykcji
 * (piasek = il = 0) odpadaja.
 */
export function layerFromRasters(
  depth: (typeof SOILGRIDS_DEPTHS)[number],
  rasters: Record<Property, Raster>,
  field: FieldArea,
  candidates: number[] = pixelsInField(rasters.sand, field),
): SoilLayer | null {
  const pixels = candidates.filter((index) => predicted(rasters, index));

  if (pixels.length === 0) return null;

  const mean = (property: Property) =>
    pixels.reduce((sum, index) => sum + (rasters[property].values[index] ?? 0), 0) /
    pixels.length /
    PROPERTIES[property];
  const sandPct = mean('sand');
  const clayPct = mean('clay');

  return {
    topCm: depth.topCm,
    bottomCm: depth.bottomCm,
    sandPct,
    clayPct,
    siltPct: Math.max(0, 100 - sandPct - clayPct),
    organicCarbonGPerKg: mean('soc'),
  };
}

/** Wykonuje zadania z ograniczona liczba jednoczesnych. */
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = Array.from({ length: jobs.length });
  let next = 0;

  // kazdy pracownik bierze kolejne zadanie dopiero po skonczeniu poprzedniego
  async function worker(): Promise<void> {
    const index = next;
    const job = jobs[index];

    if (!job) return;

    next += 1;
    results[index] = await job();

    return worker();
  }

  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));

  return results;
}

const MODEL_NOTE = 'globalny model uczenia maszynowego 250 m, nie mapa glebowa';
const NO_PREDICTION = 'w polu SoilGrids nie ma predykcji (zabudowa albo woda)';

/** Blad z gotowym polskim opisem (odpowiedz HTTP) - nie owijamy go drugi raz. */
class SoilGridsFailure extends Error {}

const asError = (error: unknown): Error =>
  error instanceof SoilGridsFailure ? error : new SoilGridsFailure(failureNote('SoilGrids', error));

interface DepthRasters {
  depth: (typeof SOILGRIDS_DEPTHS)[number];
  rasters: Record<Property, Raster>;
}

/** 18 pokryc (3 wlasciwosci x 6 warstw) dla prostokata pola z marginesem, w puli. */
async function fetchRasters(
  fetchImpl: FetchLike,
  bbox: FieldArea['bbox'],
  signal: AbortSignal,
  pad?: [number, number],
): Promise<DepthRasters[]> {
  const properties = Object.keys(PROPERTIES) as Property[];
  const jobs = SOILGRIDS_DEPTHS.flatMap((depth) =>
    properties.map((property) => async () => {
      const response = await fetchImpl(coverageUrl(property, depth.label, bbox, pad), { signal });

      if (!response.ok) throw new SoilGridsFailure(httpFailureNote('SoilGrids', response.status));

      return readGeoTiff(await response.arrayBuffer());
    }),
  );
  const rasters = await pooled(jobs, CONCURRENCY);

  return SOILGRIDS_DEPTHS.flatMap((depth, index) => {
    const [sand, clay, soc] = rasters.slice(index * properties.length, (index + 1) * properties.length);

    return sand && clay && soc ? [{ depth, rasters: { sand, clay, soc } }] : [];
  });
}

/** Drugi odczyt z marginesem 2 km i gleba z najblizszych pikseli z predykcja; nadal nic = `missing`. */
async function substitute(
  fetchLayers: (pad?: [number, number]) => Promise<DepthRasters[]>,
  field: FieldArea,
  base: SourceRef,
): Promise<Sourced<SoilProfile>> {
  const widest = SUBSTITUTE_RINGS_M.at(-1) ?? 0;
  const around = await fetchLayers(padFor(widest, field.centroid[1])).catch(asError);

  if (around instanceof Error) {
    return { data: null, source: { ...base, note: `${NO_PREDICTION}; ${around.message}` } };
  }

  // piksele wybiera warstwa wierzchnia; glebsze warstwy usredniamy po tych samych miejscach
  const top = around[0];
  const nearby = top ? substitutePixels(top.rasters, field) : null;
  const layers = nearby
    ? around.flatMap(({ depth, rasters }) => layerFromRasters(depth, rasters, field, nearby.pixels) ?? [])
    : [];
  const profile = soilProfileFromLayers(layers);

  if (!nearby || !profile) {
    return {
      data: null,
      source: { ...base, note: `${NO_PREDICTION}, także w promieniu ${widest / 1000} km od pola` },
    };
  }

  const distanceM = Math.max(50, Math.round(nearby.distanceM / 50) * 50);

  return {
    data: { ...profile, substituteDistanceM: distanceM },
    source: {
      ...base,
      status: 'partial',
      url: coverageUrl('sand', SOILGRIDS_DEPTHS[0].label, field.bbox, padFor(widest, field.centroid[1])),
      note: `${NO_PREDICTION}; gleba z najbliższego obszaru z predykcją, ok. ${distanceM} m od pola (${nearby.pixels.length} pikseli); ${MODEL_NOTE}; grupa granulometryczna ${profile.textureClass ?? 'nieustalona'}`,
    },
  };
}

export function createSoilGridsSource({
  fetch: fetchImpl = (url, init) => fetch(url, init),
  now = () => new Date().toISOString(),
}: SoilGridsOptions = {}): SoilSource {
  return {
    async profile(field): Promise<Sourced<SoilProfile>> {
      const base: SourceRef = {
        id: 'soil',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        url: coverageUrl('sand', SOILGRIDS_DEPTHS[0].label, field.bbox),
        resolution: RESOLUTION,
        fetchedAt: now(),
      };
      const signal = AbortSignal.timeout(TIMEOUT_MS);
      const fetchLayers = (pad?: [number, number]) => fetchRasters(fetchImpl, field.bbox, signal, pad);
      const own = await fetchLayers().catch(asError);

      if (own instanceof Error) return { data: null, source: { ...base, note: own.message } };

      const layers = own.flatMap(({ depth, rasters }) => layerFromRasters(depth, rasters, field) ?? []);
      const profile = soilProfileFromLayers(layers);

      if (profile) {
        const complete = layers.length === SOILGRIDS_DEPTHS.length;

        return {
          data: profile,
          source: {
            ...base,
            status: complete ? 'ok' : 'partial',
            note: `${MODEL_NOTE}; grupa granulometryczna ${profile.textureClass ?? 'nieustalona'}${complete ? '' : `; ${SOILGRIDS_DEPTHS.length - layers.length} z 6 warstw bez predykcji`}`,
          },
        };
      }

      return substitute(fetchLayers, field, base);
    },
  };
}
