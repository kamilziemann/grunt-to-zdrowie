// Adapter SoilSource na SoilGrids 2.0 (ISRIC, https://docs.isric.org/globaldata/soilgrids/wcs.html): piasek, il
// i wegiel organiczny w szesciu warstwach do 2 m z uslugi WCS (REST ISRIC jest wstrzymany i oddaje puste wartosci).
// Jedno zapytanie = jedna wlasciwosc i warstwa dla prostokata pola; pyl to reszta do 100%. Wartosci usredniamy po
// pikselach, ktorych srodek lezy w polu (male pole: wszystkie piksele prostokata). SoilGrids to globalny model
// uczenia maszynowego w siatce 250 m, a nie mapa glebowo-rolnicza - SourceRef mowi to wprost, a kategoria gleby
// dostaje zakres (domain/soil-profile). Zero we wszystkich frakcjach = brak predykcji (zabudowa, woda).
import type { FieldArea, SourceRef } from '@app/contracts';

import type { SoilProfile, SoilSource, Sourced } from '../../domain/analysis-ports';
import { containsPoint } from '../../domain/parcel-geometry';
import { soilProfileFromLayers, type SoilLayer } from '../../domain/soil-profile';
import { readGeoTiff, type Raster } from './geotiff';

export const SOILGRIDS_WCS_URL = 'https://maps.isric.org/mapserv';

const PROVIDER = 'ISRIC SoilGrids 2.0 (globalny model uziarnienia, 250 m - nie mapa glebowo-rolnicza)';
const LICENCE = 'CC BY 4.0 (ISRIC - World Soil Information)';
const RESOLUTION = '250 m (model globalny)';
const TIMEOUT_MS = 6000;
/** ISRIC kolejkuje zapytania jednego klienta: 3-4 naraz konczy sie szybciej niz 18 naraz */
const CONCURRENCY = 4;
/** margines wokol pola (stopnie), zeby nawet male pole trafilo w piksel */
const PAD_DEG = 0.0015;

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

export function coverageUrl(property: Property, depth: string, bbox: FieldArea['bbox']): string {
  const [west, south, east, north] = bbox;
  const fixed = (value: number) => value.toFixed(5);

  return (
    `${SOILGRIDS_WCS_URL}?map=/map/${property}.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage` +
    `&COVERAGEID=${property}_${depth}_mean&FORMAT=image/tiff` +
    `&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326` +
    `&SUBSET=long(${fixed(west - PAD_DEG)},${fixed(east + PAD_DEG)})` +
    `&SUBSET=lat(${fixed(south - PAD_DEG)},${fixed(north + PAD_DEG)})`
  );
}

/** Indeksy pikseli, ktorych srodek lezy w polu; gdy zaden (pole mniejsze od piksela) - wszystkie. */
function pixelsInField(raster: Raster, field: FieldArea): number[] {
  const all = Array.from({ length: raster.width * raster.height }, (_unused, index) => index);
  const inside = all.filter((index) => {
    const x = raster.originX + ((index % raster.width) + 0.5) * raster.pixelX;
    const y = raster.originY - (Math.floor(index / raster.width) + 0.5) * raster.pixelY;

    return containsPoint(field.geometry, [x, y]);
  });

  return inside.length > 0 ? inside : all;
}

/** Usrednia trzy wlasciwosci warstwy po tych samych pikselach; piksele bez predykcji (piasek = il = 0) odpadaja. */
export function layerFromRasters(
  depth: (typeof SOILGRIDS_DEPTHS)[number],
  rasters: Record<Property, Raster>,
  field: FieldArea,
): SoilLayer | null {
  const pixels = pixelsInField(rasters.sand, field).filter((index) => {
    const sand = rasters.sand.values[index] ?? 0;
    const clay = rasters.clay.values[index] ?? 0;

    return sand > 0 || clay > 0;
  });

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
      const properties = Object.keys(PROPERTIES) as Property[];
      const jobs = SOILGRIDS_DEPTHS.flatMap((depth) =>
        properties.map((property) => async () => {
          const response = await fetchImpl(coverageUrl(property, depth.label, field.bbox), { signal });

          if (!response.ok) throw new Error(`SoilGrids responded with HTTP ${response.status}`);

          return readGeoTiff(await response.arrayBuffer());
        }),
      );
      const rasters = await pooled(jobs, CONCURRENCY).catch((error: unknown) =>
        error instanceof Error ? error : new Error('SoilGrids request failed'),
      );

      if (rasters instanceof Error) return { data: null, source: { ...base, note: rasters.message } };

      const layers = SOILGRIDS_DEPTHS.flatMap((depth, index) => {
        const [sand, clay, soc] = rasters.slice(index * properties.length, (index + 1) * properties.length);

        if (!sand || !clay || !soc) return [];

        const layer = layerFromRasters(depth, { sand, clay, soc }, field);

        return layer ? [layer] : [];
      });
      const profile = soilProfileFromLayers(layers);

      if (!profile) {
        return {
          data: null,
          source: { ...base, note: 'no SoilGrids prediction for this area (built-up land or water)' },
        };
      }

      const complete = layers.length === SOILGRIDS_DEPTHS.length;

      return {
        data: profile,
        source: {
          ...base,
          status: complete ? 'ok' : 'partial',
          note: `global 250 m machine-learning model, not a soil map; texture class ${profile.textureClass ?? 'n/a'}${complete ? '' : `; ${SOILGRIDS_DEPTHS.length - layers.length} of 6 layers without prediction`}`,
        },
      };
    },
  };
}
