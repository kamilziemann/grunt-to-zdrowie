// Adapter VegetationSource na API statystyk Copernicus Data Space (Sentinel Hub Statistical API,
// https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html): srednie NDVI i NDMI pola dla
// kazdego dnia ze scena Sentinel-2 L2A, z maska chmur z warstwy klasyfikacji sceny (SCL: tylko 4 roslinnosc
// i 5 gleba odslonieta). Jedno zapytanie na przedzial: 30 dni do daty analizy oraz +-10 dni wokol tej samej daty
// w kazdym z poprzednich lat od 2017 (porownanie tej samej pory roku). Token OAuth `client_credentials`.
// Brak kluczy, blad tokenu albo limit czasu = `missing`; brak czystej sceny w oknie = `partial`.
import type { FieldArea, SourceRef } from '@app/contracts';

import type {
  Sourced,
  VegetationObservation,
  VegetationSeries,
  VegetationSource,
} from '../../domain/analysis-ports';
import { addDays, daysBetween, withYear, yearOf } from '../../domain/iso-date';

export const CDSE_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
export const CDSE_STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

const PROVIDER = 'Copernicus Data Space Ecosystem - Sentinel-2 L2A (API statystyk)';
const LICENCE = 'dane Copernicus Sentinel, otwarte (podać: "Contains modified Copernicus Sentinel data")';
const RESOLUTION = '10 m (NDMI z pasma B11 20 m)';
/** archiwum L2A w CDSE jest pelne od 2017 r. */
export const FIRST_SENTINEL_YEAR = 2017;
const CURRENT_WINDOW_DAYS = 30;
const BASELINE_HALF_WINDOW_DAYS = 10;
/** 5 lat porownania: 6 zapytan na analize - darmowe konto CDSE ma limit zapytan na minute i na miesiac */
const BASELINE_MAX_YEARS = 5;
const CELL_M = 10;
const MAX_SIDE_PX = 2000;
/** obserwacja liczy sie, gdy czyste piksele to min. 60% pola i co najmniej 5 pikseli (albo cale male pole) */
const MIN_VALID_SHARE = 0.6;
const MIN_PIXELS = 5;
const TIMEOUT_MS = 9000;
/** CDSE odrzuca serie wielu jednoczesnych zapytan (HTTP 429) - po 3 naraz i jedna ponowna proba */
const CONCURRENCY = 3;
const RETRY_AFTER_MS = 1000;

export const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "SCL", "dataMask"] }],
    output: [
      { id: "indices", bands: ["ndvi", "ndmi"], sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var clear = (s.SCL === 4 || s.SCL === 5) ? 1 : 0;
  var ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  var ndmi = (s.B08 - s.B11) / (s.B08 + s.B11);
  return { indices: [ndvi, ndmi], dataMask: [s.dataMask * clear] };
}`;

export type FetchLike = (url: string, init: RequestInit & { signal: AbortSignal }) => Promise<Response>;

export interface SentinelStatisticsOptions {
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetch?: FetchLike;
  now?: () => string;
}

interface Stats {
  mean?: number;
  sampleCount?: number;
  noDataCount?: number;
}

interface StatisticsResponse {
  data?: {
    interval?: { from?: string };
    outputs?: { indices?: { bands?: { ndvi?: { stats?: Stats }; ndmi?: { stats?: Stats } } } };
  }[];
}

export interface Window {
  from: string;
  to: string;
  /** rok porownania; null = okno biezace */
  year: number | null;
}

/** Okno biezace i okna tej samej pory roku w poprzednich latach (od 2017, najwyzej 8 lat). */
export function windowsFor(date: string): Window[] {
  const year = yearOf(date);
  const years = Array.from({ length: BASELINE_MAX_YEARS }, (_unused, index) => year - 1 - index).filter(
    (candidate) => candidate >= FIRST_SENTINEL_YEAR,
  );

  return [
    { from: addDays(date, -(CURRENT_WINDOW_DAYS - 1)), to: date, year: null },
    ...years.map((candidate) => {
      const anniversary = withYear(date, candidate);

      return {
        from: addDays(anniversary, -BASELINE_HALF_WINDOW_DAYS),
        to: addDays(anniversary, BASELINE_HALF_WINDOW_DAYS),
        year: candidate,
      };
    }),
  ];
}

/** Wymiary rastra w pikselach 10 m dla prostokata pola. */
export function rasterSize(bbox: FieldArea['bbox']): { width: number; height: number } {
  const [west, south, east, north] = bbox;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos((((south + north) / 2) * Math.PI) / 180);
  const side = (meters: number) => Math.min(MAX_SIDE_PX, Math.max(1, Math.round(meters / CELL_M)));

  return { width: side((east - west) * metersPerDegLng), height: side((north - south) * metersPerDegLat) };
}

export function statisticsBody(field: FieldArea, window: Window): unknown {
  return {
    input: {
      bounds: {
        geometry: field.geometry,
        properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
      },
      data: [{ type: 'sentinel-2-l2a' }],
    },
    aggregation: {
      timeRange: { from: `${window.from}T00:00:00Z`, to: `${window.to}T23:59:59Z` },
      aggregationInterval: { of: 'P1D' },
      ...rasterSize(field.bbox),
      evalscript: EVALSCRIPT,
    },
    calculations: { default: {} },
  };
}

const round = (value: number, digits = 3): number => Number(value.toFixed(digits));

/** Dni z czysta scena: srednie pola, udzial i liczba czystych pikseli. */
export function parseStatistics(body: unknown): VegetationObservation[] {
  const data = (body as StatisticsResponse).data ?? [];

  return data.flatMap((item) => {
    const date = item.interval?.from?.slice(0, 10);
    const bands = item.outputs?.indices?.bands;
    const ndvi = bands?.ndvi?.stats;
    const ndmi = bands?.ndmi?.stats;
    const total = ndvi?.sampleCount ?? 0;
    const valid = total - (ndvi?.noDataCount ?? total);

    if (!date || total === 0 || valid <= 0) return [];

    const validShare = valid / total;

    if (validShare < MIN_VALID_SHARE || valid < Math.min(MIN_PIXELS, total)) return [];

    return [
      {
        date,
        ndvi: typeof ndvi?.mean === 'number' && Number.isFinite(ndvi.mean) ? round(ndvi.mean) : null,
        ndmi: typeof ndmi?.mean === 'number' && Number.isFinite(ndmi.mean) ? round(ndmi.mean) : null,
        validShare: round(validShare, 2),
        pixels: valid,
      },
    ];
  });
}

/** Najblizsza rocznicy daty analizy czysta obserwacja w danym roku. */
function closestTo(observations: VegetationObservation[], target: string): VegetationObservation | undefined {
  return observations.toSorted(
    (a, b) => Math.abs(daysBetween(a.date, target)) - Math.abs(daysBetween(b.date, target)),
  )[0];
}

/** Wykonuje zadania z ograniczona liczba jednoczesnych, zachowujac kolejnosc wynikow. */
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

/** Jedna ponowna proba po HTTP 429 (limit chwilowy), po czasie z `Retry-After`, najwyzej 2 s. */
async function withRetryOn429(send: () => Promise<Response>): Promise<Response> {
  const response = await send();

  if (response.status !== 429) return response;

  const seconds = Number(response.headers.get('retry-after'));
  const waitMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 2000) : RETRY_AFTER_MS;

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  return send();
}

export function createSentinelStatisticsSource({
  clientId,
  clientSecret,
  fetch: fetchImpl = (url, init) => fetch(url, init),
  now = () => new Date().toISOString(),
}: SentinelStatisticsOptions): VegetationSource {
  return {
    async series(field, date): Promise<Sourced<VegetationSeries>> {
      const base: SourceRef = {
        id: 'vegetation',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        url: CDSE_STATISTICS_URL,
        resolution: RESOLUTION,
        fetchedAt: now(),
      };
      const missing = (note: string): Sourced<VegetationSeries> => ({
        data: null,
        source: { ...base, note },
      });

      if (!clientId || !clientSecret) return missing('COPERNICUS_CLIENT_ID/SECRET are not configured');

      if (yearOf(date) < FIRST_SENTINEL_YEAR) return missing('no Sentinel-2 L2A archive before 2017');

      const signal = AbortSignal.timeout(TIMEOUT_MS);

      try {
        const tokenResponse = await fetchImpl(CDSE_TOKEN_URL, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        });

        if (!tokenResponse.ok)
          return missing(`Copernicus token request failed: HTTP ${tokenResponse.status}`);

        const { access_token: token } = (await tokenResponse.json()) as { access_token?: string };

        if (!token) return missing('Copernicus token response without access_token');

        const windows = windowsFor(date);
        const request = (window: Window) => () =>
          fetchImpl(CDSE_STATISTICS_URL, {
            method: 'POST',
            signal,
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify(statisticsBody(field, window)),
          });
        const results = await pooled(
          windows.map((window) => async () => {
            const response = await withRetryOn429(request(window));

            return response.ok
              ? { window, observations: parseStatistics(await response.json()), status: response.status }
              : { window, observations: null, status: response.status };
          }),
          CONCURRENCY,
        );
        const [current, ...past] = results;
        const failed = results.filter((result) => result.observations === null);

        if (!current || failed.length === results.length) {
          return missing(`Copernicus statistics responded with HTTP ${failed[0]?.status ?? 'error'}`);
        }

        const observations = (current.observations ?? []).toSorted((a, b) => b.date.localeCompare(a.date));
        const baseline = past.flatMap(({ window, observations: yearly }) => {
          const best =
            window.year === null || yearly === null
              ? undefined
              : closestTo(yearly, withYear(date, window.year));

          return best && window.year !== null ? [{ ...best, year: window.year }] : [];
        });
        const notes = [
          current.observations === null
            ? `current window failed with HTTP ${current.status}`
            : observations.length === 0
              ? `no clear scene within ${CURRENT_WINDOW_DAYS} days before ${date}`
              : null,
          `same season in ${baseline.length} of ${past.length} earlier years`,
          failed.length > 0
            ? `${failed.length} of ${results.length} requests refused (HTTP ${failed[0]?.status})`
            : null,
        ].filter((note): note is string => note !== null);

        return {
          data: { observations, baseline, cellSizeM: CELL_M },
          source: {
            ...base,
            status: observations.length > 0 && failed.length === 0 ? 'ok' : 'partial',
            dataFrom: windows.at(-1)?.from ?? windows[0]?.from ?? date,
            dataTo: date,
            note: notes.join('; '),
          },
        };
      } catch (error) {
        return missing(error instanceof Error ? error.message : 'Copernicus request failed');
      }
    },
  };
}
