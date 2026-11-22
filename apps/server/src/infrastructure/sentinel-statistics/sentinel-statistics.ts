// Adapter VegetationSource na API statystyk Copernicus Data Space (Sentinel Hub Statistical API,
// https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html): srednie NDVI i NDMI pola dla
// kazdego dnia ze scena Sentinel-2 L2A, z maska chmur z warstwy klasyfikacji sceny (SCL: tylko 4 roslinnosc
// i 5 gleba odslonieta). Jedno zapytanie na przedzial: 30 dni do daty analizy oraz +-10 dni wokol tej samej daty
// w kazdym z poprzednich lat od 2017 (porownanie tej samej pory roku). Token OAuth `client_credentials`.
// Rownolegle jedno zapytanie Process API: raster NDVI/NDMI pola na siatce komorek stref (domain/field-grid, UTM,
// piksele Sentinel-2 bez przeprobkowania) z najmniej zachmurzonej sceny okna, z maska chmur.
// Brak kluczy, blad tokenu albo limit czasu = `missing`; brak czystej sceny w oknie = `partial`; brak rastra nie
// zmienia statusu (strefy powstana wtedy z samego terenu), mowi o nim notatka.
import type { FieldArea, SourceRef } from '@app/contracts';

import type {
  Sourced,
  VegetationObservation,
  VegetationRaster,
  VegetationSeries,
  VegetationSource,
} from '../../domain/analysis-ports';
import { fieldGrid, gridTooLarge, type GridSpec } from '../../domain/field-grid';
import { addDays, daysBetween, isoDate, monthOf, withYear, yearOf } from '../../domain/iso-date';
import { readGeoTiff } from '../geotiff';
import { failureNote, httpFailureNote } from '../../lib/source-note';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';
import { sourceCacheTtl } from '../../domain/source-cache-policy';
import { FIRST_SENTINEL_YEAR } from '../../domain/vegetation-signal';

export const CDSE_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
export const CDSE_STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
export const CDSE_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

const PROVIDER = 'Copernicus Data Space Ecosystem - Sentinel-2 L2A (API statystyk)';
const LICENCE = 'dane Copernicus Sentinel, otwarte (podać: "Contains modified Copernicus Sentinel data")';
const RESOLUTION = '10 m (NDMI z pasma B11 20 m)';

export { FIRST_SENTINEL_YEAR };
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
/**
 * CDSE odrzuca serie wielu jednoczesnych zapytan (HTTP 429) - po 3 naraz i do dwoch ponownych prob z rosnacym
 * odstepem (0,8 s, potem 1,6 s z rozrzutem, zeby rownolegle zapytania nie wracaly w tej samej chwili). Laczne
 * czekanie miesci sie w limicie zrodla (10 s); odpowiedzi 200 trafiaja do pamieci, wiec powtorka nie pyta CDSE.
 */
const CONCURRENCY = 3;
const RETRY_DELAYS_MS = [800, 1600] as const;
const RETRY_MAX_WAIT_MS = 2500;

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

/** Raster pola: NDVI i NDMI jako dwie probki float 32; chmura, cien, woda albo brak sceny = NaN. */
export const RASTER_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "SCL", "dataMask"] }],
    output: { bands: 2, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(s) {
  if (s.dataMask === 0 || (s.SCL !== 4 && s.SCL !== 5)) return [NaN, NaN];
  return [(s.B08 - s.B04) / (s.B08 + s.B04), (s.B08 - s.B11) / (s.B08 + s.B11)];
}`;

/** Process API oddaje najwyzej 2500 pikseli na bok. */
const RASTER_MAX_SIDE_PX = 2500;
/** raster uzywamy, gdy czyste piksele to co najmniej polowa prostokata pola */
const RASTER_MIN_VALID_SHARE = 0.5;

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

/**
 * Ile pikseli rastra statystyk lezy w samym polu. API liczy `sampleCount` dla calego prostokata rastra, a piksele
 * poza poligonem oddaje jako `noDataCount` - dzialka ukosna albo trojkatna (349/1 w Chwalimiu: 45% prostokata)
 * nigdy nie mialaby 60% "czystych" pikseli, choc niebo nad nia jest bezchmurne.
 */
export function fieldPixelCount(field: Pick<FieldArea, 'bbox' | 'areaHa'>): number {
  const [west, south, east, north] = field.bbox;
  const { width, height } = rasterSize(field.bbox);
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos((((south + north) / 2) * Math.PI) / 180);
  const pixelM2 =
    (((east - west) * metersPerDegLng) / width) * (((north - south) * metersPerDegLat) / height);

  return Math.max(1, Math.min(width * height, Math.round((field.areaHa * 10_000) / pixelM2)));
}

/** Wymiary rastra w pikselach 10 m dla prostokata pola. */
export function rasterSize(bbox: FieldArea['bbox']): { width: number; height: number } {
  const [west, south, east, north] = bbox;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos((((south + north) / 2) * Math.PI) / 180);
  const side = (meters: number) => Math.min(MAX_SIDE_PX, Math.max(1, Math.round(meters / CELL_M)));

  return { width: side((east - west) * metersPerDegLng), height: side((north - south) * metersPerDegLat) };
}

/**
 * Okno zdjec do rastra stref: 30 dni do daty analizy w sezonie (kwiecien-wrzesien); poza sezonem - lato
 * poprzedniego sezonu (1 VI - 31 VIII), bo zima zdjecie pokazuje snieg albo gola gleba, nie wilgotnosc roslin.
 */
export function rasterWindow(date: string): { from: string; to: string } {
  const month = monthOf(date);

  if (month >= 4 && month <= 9) return { from: addDays(date, -(CURRENT_WINDOW_DAYS - 1)), to: date };

  const year = month >= 10 ? yearOf(date) : yearOf(date) - 1;

  return { from: isoDate(year, 6, 1), to: isoDate(year, 8, 31) };
}

export function rasterBody(spec: GridSpec, window: { from: string; to: string }): unknown {
  return {
    input: {
      bounds: {
        bbox: [
          spec.west,
          spec.north - spec.rows * spec.cellSizeM,
          spec.west + spec.cols * spec.cellSizeM,
          spec.north,
        ],
        properties: { crs: `http://www.opengis.net/def/crs/EPSG/0/${spec.epsg}` },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: { from: `${window.from}T00:00:00Z`, to: `${window.to}T23:59:59Z` },
            mosaickingOrder: 'leastCC',
          },
        },
      ],
    },
    output: {
      width: spec.cols,
      height: spec.rows,
      responses: [{ identifier: 'default', format: { type: 'image/tiff' } }],
    },
    evalscript: RASTER_EVALSCRIPT,
  };
}

/** GeoTIFF z Process API -> raster pola; null, gdy wymiary sie nie zgadzaja albo czystych pikseli jest za malo. */
export async function parseRaster(
  buffer: ArrayBuffer,
  spec: GridSpec,
  window: { from: string; to: string },
): Promise<VegetationRaster | null> {
  const tiff = await readGeoTiff(buffer);
  const [ndvi, ndmi] = tiff.bands;

  if (!ndvi || !ndmi || tiff.width !== spec.cols || tiff.height !== spec.rows) return null;

  const valid = [...ndmi].filter((value) => Number.isFinite(value)).length;

  if (valid < RASTER_MIN_VALID_SHARE * ndmi.length) return null;

  return {
    epsg: spec.epsg,
    west: spec.west,
    north: spec.north,
    cellSizeM: spec.cellSizeM,
    cols: spec.cols,
    rows: spec.rows,
    ndvi: [...ndvi].map((value) => (Number.isFinite(value) ? round(value) : Number.NaN)),
    ndmi: [...ndmi].map((value) => (Number.isFinite(value) ? round(value) : Number.NaN)),
    from: window.from,
    to: window.to,
  };
}

/** token OAuth zyje ok. 10 min - pamietamy go krocej, zeby nigdy nie oddac wygaslego */
const TOKEN_TTL_S = 300;

/**
 * Czas zycia odpowiedzi w pamieci: token - 5 min; statystyki - z konca okna (`aggregation.timeRange.to`), bo
 * archiwum sprzed kilkunastu dni sie nie zmienia, a ostatnie dni dostaja jeszcze nowe sceny.
 */
export function sentinelCacheTtl(today: () => string) {
  return (url: string, init: RequestInit | undefined): number => {
    if (url === CDSE_TOKEN_URL) return TOKEN_TTL_S;

    if ((url !== CDSE_STATISTICS_URL && url !== CDSE_PROCESS_URL) || typeof init?.body !== 'string') return 0;

    const body = JSON.parse(init.body) as {
      aggregation?: { timeRange?: { to?: string } };
      input?: { data?: { dataFilter?: { timeRange?: { to?: string } } }[] };
    };
    const end = body.aggregation?.timeRange?.to ?? body.input?.data?.[0]?.dataFilter?.timeRange?.to;
    const to = end?.slice(0, 10) ?? null;

    return sourceCacheTtl(to, today());
  };
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

/**
 * Dni ze scena w oknie, podzielone na uzyte (czyste) i odrzucone przez maske chmur: srednie pola, udzial i liczba
 * czystych pikseli. Udzial liczymy wzgledem pikseli pola (`fieldPixels`), nie calego prostokata rastra; bez tej
 * liczby - wzgledem prostokata (pole prostokatne). Scena calkiem zachmurzona ma udzial 0 i indeksy null.
 */
export function classifyStatistics(
  body: unknown,
  fieldPixels?: number,
): { used: VegetationObservation[]; rejected: VegetationObservation[] } {
  const data = (body as StatisticsResponse).data ?? [];
  const used: VegetationObservation[] = [];
  const rejected: VegetationObservation[] = [];

  for (const item of data) {
    const date = item.interval?.from?.slice(0, 10);
    const bands = item.outputs?.indices?.bands;
    const ndvi = bands?.ndvi?.stats;
    const ndmi = bands?.ndmi?.stats;
    const total = ndvi?.sampleCount ?? 0;
    const valid = Math.max(total - (ndvi?.noDataCount ?? total), 0);

    if (!date || total === 0) continue;

    const validShare = Math.min(1, valid / Math.min(total, fieldPixels ?? total));
    const clear = valid > 0 && validShare >= MIN_VALID_SHARE && valid >= Math.min(MIN_PIXELS, total);
    const mean = (stats: Stats | undefined) =>
      valid > 0 && typeof stats?.mean === 'number' && Number.isFinite(stats.mean) ? round(stats.mean) : null;

    (clear ? used : rejected).push({
      date,
      ndvi: mean(ndvi),
      ndmi: mean(ndmi),
      validShare: round(validShare, 2),
      pixels: valid,
    });
  }

  return { used, rejected };
}

/** Dni z czysta scena (zob. `classifyStatistics`). */
export function parseStatistics(body: unknown, fieldPixels?: number): VegetationObservation[] {
  return classifyStatistics(body, fieldPixels).used;
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

/** Ponowne proby po HTTP 429 (limit chwilowy): czas z `Retry-After` albo rosnacy odstep z rozrzutem. */
export async function withRetryOn429(
  send: () => Promise<Response>,
  delaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<Response> {
  let response = await send();

  for (const delay of delaysMs) {
    if (response.status !== 429) return response;

    const seconds = Number(response.headers.get('retry-after'));
    const jitter = Math.round(Math.random() * delay * 0.25);
    const waitMs = Math.min(
      Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : delay + jitter,
      RETRY_MAX_WAIT_MS,
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
    response = await send();
  }

  return response;
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

      if (!clientId || !clientSecret)
        return missing('brak kluczy dostępu do Copernicus w konfiguracji (COPERNICUS_CLIENT_ID/SECRET)');

      if (yearOf(date) < FIRST_SENTINEL_YEAR)
        return missing('archiwum zdjęć Sentinel-2 zaczyna się w 2017 r.');

      const signal = AbortSignal.timeout(TIMEOUT_MS);

      try {
        const tokenResponse = await fetchImpl(CDSE_TOKEN_URL, {
          method: 'POST',
          signal,
          headers: {
            'user-agent': OUTBOUND_USER_AGENT,
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        });

        if (!tokenResponse.ok)
          return missing(`logowanie do Copernicus: ${httpFailureNote('Copernicus', tokenResponse.status)}`);

        const { access_token: token } = (await tokenResponse.json()) as { access_token?: string };

        if (!token) return missing('Copernicus nie zwrócił tokenu dostępu');

        const spec = fieldGrid(field.geometry, field.centroid[0], field.areaHa);
        const rasterFits =
          !gridTooLarge(spec) && spec.cols <= RASTER_MAX_SIDE_PX && spec.rows <= RASTER_MAX_SIDE_PX;
        const imageWindow = rasterWindow(date);
        // raster rusza od razu, obok puli statystyk; jego blad nie psuje statystyk
        const rasterResult = rasterFits
          ? withRetryOn429(() =>
              fetchImpl(CDSE_PROCESS_URL, {
                method: 'POST',
                signal,
                headers: {
                  'user-agent': OUTBOUND_USER_AGENT,
                  authorization: `Bearer ${token}`,
                  'content-type': 'application/json',
                  accept: 'image/tiff',
                },
                body: JSON.stringify(rasterBody(spec, imageWindow)),
              }),
            )
              .then(async (response) =>
                response.ok
                  ? {
                      raster: await parseRaster(await response.arrayBuffer(), spec, imageWindow),
                      status: 200,
                    }
                  : { raster: null, status: response.status },
              )
              // nieczytelny plik albo przerwane polaczenie: strefy powstana z samego terenu
              .catch(() => ({ raster: null, status: 0 }))
          : Promise.resolve(null);
        const windows = windowsFor(date);
        const request = (window: Window) => () =>
          fetchImpl(CDSE_STATISTICS_URL, {
            method: 'POST',
            signal,
            headers: {
              'user-agent': OUTBOUND_USER_AGENT,
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify(statisticsBody(field, window)),
          });
        const results = await pooled(
          windows.map((window) => async () => {
            const response = await withRetryOn429(request(window));

            if (!response.ok) return { window, observations: null, rejected: [], status: response.status };

            const { used, rejected } = classifyStatistics(await response.json(), fieldPixelCount(field));

            return { window, observations: used, rejected, status: response.status };
          }),
          CONCURRENCY,
        );
        const [current, ...past] = results;
        const raster = await rasterResult;
        const failed = results.filter((result) => result.observations === null);

        if (!current || failed.length === results.length) {
          return missing(httpFailureNote('Copernicus', failed[0]?.status ?? 500));
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
            ? `zdjęcia z ostatnich ${CURRENT_WINDOW_DAYS} dni: ${httpFailureNote('Copernicus', current.status)}`
            : observations.length === 0
              ? `brak bezchmurnego zdjęcia w ${CURRENT_WINDOW_DAYS} dniach przed ${date}`
              : null,
          `porównanie z tą samą porą roku w ${baseline.length} z ${past.length} wcześniejszych lat`,
          failed.length > 0
            ? `${failed.length} z ${results.length} zapytań odrzuconych (HTTP ${failed[0]?.status})`
            : null,
          raster === null
            ? 'mapa pola do stref: pole za duże albo rozproszone'
            : raster.raster
              ? `mapa wilgotności roślin na polu: najmniej zachmurzona scena z ${imageWindow.from} – ${imageWindow.to}`
              : raster.status === 200
                ? `mapa pola do stref: za dużo chmur w ${imageWindow.from} – ${imageWindow.to}`
                : `mapa pola do stref: ${raster.status === 0 ? 'brak odpowiedzi' : httpFailureNote('Copernicus', raster.status)}`,
        ].filter((note): note is string => note !== null);

        return {
          data: {
            observations,
            baseline,
            cellSizeM: CELL_M,
            rejected: current.rejected.toSorted((a, b) => b.date.localeCompare(a.date)),
            window: { from: current.window.from, to: current.window.to },
            ...(raster?.raster ? { raster: raster.raster } : {}),
          },
          source: {
            ...base,
            status: observations.length > 0 && failed.length === 0 ? 'ok' : 'partial',
            dataFrom: windows.at(-1)?.from ?? windows[0]?.from ?? date,
            dataTo: date,
            note: notes.join('; '),
          },
        };
      } catch (error) {
        return missing(failureNote('Copernicus', error));
      }
    },
  };
}
