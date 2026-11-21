// Adapter VegetationImagerySource na Copernicus Data Space (Sentinel Hub API, Sentinel-2 L2A). Trzy kroki:
// 1) katalog STAC: sceny z okna dat nad polem, od najmniej zachmurzonej,
// 2) API statystyk: dla kolejnych kandydatow czesc pola bez chmur (warstwa SCL) i percentyle wskaznika w polu,
// 3) Process API: PNG ze wskaznikiem pokolorowanym na zakres z kroku 2, przyciety do geometrii (`dataMask`).
// Wskaznik: NDVI (kondycja roslin, B04/B08, 10 m) albo NDMI (woda w roslinach, B8A/B11, 20 m) - ten sam przebieg.
// Kroki 2 i 3 ida osobno dla kazdej dzialki: Sentinel Hub odrzuca MultiPolygon ze stykajacymi sie czesciami, a tak
// wyglada pole z sasiednich dzialek (sumy wielokatow nie liczymy - to wymagaloby biblioteki geometrii).
// Skala jest wzgledna (5.-95. percentyl pola, z minimalna rozpietoscia), bo rolnik ma zobaczyc, gdzie w polu jest
// slabiej - w pelni sezonu cale pole jest "zielone" w skali bezwzglednej. Klucze klienta OAuth zostaja na serwerze;
// token trzymamy w pamieci izolatu do wygasniecia (osobno dla kazdego klienta).
import { AppError } from '@app/http';

import { addDays } from '../../domain/iso-date';
import type { BoundingBox, PolygonGeometry } from '../../domain/parcel-geometry';
import type {
  VegetationImage,
  VegetationImagePart,
  VegetationImageRequest,
  VegetationImagerySource,
  VegetationIndex,
} from '../../domain/vegetation-imagery';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';

export const COPERNICUS_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
export const COPERNICUS_CATALOG_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
export const COPERNICUS_STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
export const COPERNICUS_PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

const TIMEOUT_MS = 12_000;
const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
/** Sceny bardziej zachmurzone w calosci nie maja szans na czyste pole - nie pytamy o nie statystyk. */
const MAX_SCENE_CLOUD = 80;
/** Ilu kandydatow sprawdzamy statystykami (kazdy to jedno zapytanie ok. 0,2 s). */
const MAX_CANDIDATES = 4;
/** Pole uznajemy za widoczne, gdy bez chmur jest co najmniej taka jego czesc. */
const MIN_CLEAR_SHARE = 0.6;
/** Najmniejsza rozpietosc skali wskaznika: jednolite pole nie moze wygladac jak pole pelne roznic. */
const MIN_NDVI_SPAN = 0.2;
/** Dluzszy bok obrazu w pikselach (Sentinel-2 ma 10 m, wygladzamy interpolacja dwuszescienna). */
const IMAGE_MAX_PX = 512;
const IMAGE_MIN_PX = 16;
/** Rozdzielczosc statystyk w stopniach (ok. 10 m) - natywna rozdzielczosc pasm B04/B08. */
const STATS_RES_DEG = 0.0001;
/** Konto darmowe ma limit zapytan na sekunde: najwyzej tyle naraz, a po 429 czekamy i ponawiamy. */
const MAX_PARALLEL = 2;
const MAX_ATTEMPTS = 4;
/** `retry-after` uslugi przychodzi w milisekundach (np. 1788); bez naglowka czekamy tyle, a dluzej nie czekamy. */
const DEFAULT_RETRY_MS = 1000;
const MAX_RETRY_MS = 4000;
/** Token odswiezamy z zapasem, zeby nie wygasl w trakcie zapytania. */
const TOKEN_MARGIN_MS = 60_000;

/** Klasy SCL, ktore zaslaniaja pole: cien chmury, chmury, cirrus, snieg. */
const HIDDEN_SCL = [3, 8, 9, 10, 11];

type Rgb = readonly [number, number, number];

/**
 * Wskazniki: (a - b) / (a + b) z dwoch pasm i kolory skali od niskiej do wysokiej wartosci - te same wartosci maja
 * tokeny legendy w apps/web (`--vegetation-*`, `--moisture-*`).
 */
export const INDICES: Record<VegetationIndex, { bands: readonly [string, string]; ramp: readonly Rgb[] }> = {
  // kondycja: czerwony -> zolty -> zielony (RdYlGn)
  ndvi: {
    bands: ['B08', 'B04'],
    ramp: [
      [215, 48, 39],
      [254, 224, 139],
      [26, 152, 80],
    ],
  },
  // woda w roslinach: brazowy (sucho) -> jasny piasek -> niebieski (wilgotno)
  ndmi: {
    bands: ['B8A', 'B11'],
    ramp: [
      [140, 81, 10],
      [246, 232, 195],
      [33, 102, 172],
    ],
  },
};

export interface CopernicusCredentials {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
}

export type Sleep = (ms: number) => Promise<void>;

export type FetchLike = (
  url: string,
  init: { method: string; signal: AbortSignal; headers: Record<string, string>; body: string },
) => Promise<Response>;

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokens = new Map<string, CachedToken>();

interface SceneCandidate {
  date: string;
  cloudCover: number;
}

/** Statystyki jednej dzialki dla jednej sceny. */
export interface FieldStats {
  /** piksele w geometrii i piksele bez chmur */
  fieldPixels: number;
  clearPixels: number;
  low: number;
  high: number;
  mean: number;
}

/** `fn` dla kazdego elementu, najwyzej `limit` naraz; wynik w kolejnosci elementow. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;

      next += 1;
      results[index] = await fn(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));

  return results;
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Sceny z katalogu: dzien i zachmurzenie, od najczystszej; przy rownym zachmurzeniu nowsza wygrywa. */
export function parseCatalog(body: unknown): SceneCandidate[] {
  const features = record(body).features;

  if (!Array.isArray(features)) throw new Error('Copernicus catalog response has no features');

  const byDate = new Map<string, number>();

  for (const feature of features) {
    const properties = record(record(feature).properties);
    const datetime = properties.datetime;
    const cloudCover = num(properties['eo:cloud_cover']);

    if (typeof datetime !== 'string' || cloudCover === null) continue;

    // dwa przeloty tego samego dnia (sasiednie orbity) - liczy sie lepszy
    const date = datetime.slice(0, 10);

    byDate.set(date, Math.min(cloudCover, byDate.get(date) ?? Infinity));
  }

  return [...byDate.entries()]
    .map(([date, cloudCover]) => ({ date, cloudCover }))
    .filter((scene) => scene.cloudCover <= MAX_SCENE_CLOUD)
    .toSorted((a, b) => a.cloudCover - b.cloudCover || b.date.localeCompare(a.date));
}

/** Statystyki wskaznika pola z odpowiedzi API statystyk; null = brak danych dla dnia. */
export function parseFieldStats(body: unknown): FieldStats | null {
  const root = record(body);
  const [interval] = Array.isArray(root.data) ? root.data : [];
  const stats = record(record(record(record(record(record(interval).outputs).index).bands).B0).stats);
  const sampleCount = num(stats.sampleCount);
  const noDataCount = num(stats.noDataCount);
  const fieldPixels = num(root.geometryPixelCount);
  const percentiles = record(stats.percentiles);
  const low = num(percentiles['5.0']);
  const high = num(percentiles['95.0']);
  const mean = num(stats.mean);

  if (sampleCount === null || noDataCount === null || low === null || high === null || mean === null)
    return null;

  // piksele poza geometria (w prostokacie statystyk) tez licza sie jako "brak danych"
  const outside = fieldPixels === null ? 0 : Math.max(0, sampleCount - fieldPixels);
  const field = sampleCount - outside;
  const clear = Math.min(field, sampleCount - noDataCount);

  return { fieldPixels: field, clearPixels: clear, low, high, mean };
}

/**
 * Pole z kilku dzialek: czesc bez chmur z sumy pikseli, percentyle i srednia wazone liczba czystych pikseli dzialki
 * (przyblizenie percentyli calego pola - wystarcza do skali kolorow). null = ktoras dzialka bez danych w tej scenie.
 */
export function combineStats(
  parts: readonly (FieldStats | null)[],
): { clearShare: number; low: number; high: number; mean: number } | null {
  if (parts.length === 0 || parts.some((part) => part === null)) return null;

  const stats = parts.filter((part) => part !== null);
  const field = stats.reduce((sum, part) => sum + part.fieldPixels, 0);
  const clear = stats.reduce((sum, part) => sum + part.clearPixels, 0);

  if (field === 0 || clear === 0) return { clearShare: 0, low: 0, high: 0, mean: 0 };

  const weighted = (pick: (part: FieldStats) => number) =>
    stats.reduce((sum, part) => sum + pick(part) * part.clearPixels, 0) / clear;

  return {
    clearShare: clear / field,
    low: weighted((part) => part.low),
    high: weighted((part) => part.high),
    mean: weighted((part) => part.mean),
  };
}

/** Zasieg wszystkich dzialek (zapytanie do katalogu scen). */
export function unionBbox(boxes: readonly BoundingBox[]): BoundingBox {
  return [
    Math.min(...boxes.map((box) => box[0])),
    Math.min(...boxes.map((box) => box[1])),
    Math.max(...boxes.map((box) => box[2])),
    Math.max(...boxes.map((box) => box[3])),
  ];
}

/** Zakres skali: percentyle pola, rozszerzone symetrycznie do minimalnej rozpietosci. */
export function colorScale(stats: { low: number; high: number }): { low: number; high: number } {
  const span = stats.high - stats.low;

  if (span >= MIN_NDVI_SPAN) return { low: stats.low, high: stats.high };

  const middle = (stats.low + stats.high) / 2;

  return { low: middle - MIN_NDVI_SPAN / 2, high: middle + MIN_NDVI_SPAN / 2 };
}

/** Wymiary obrazu w pikselach z proporcjami zasiegu w metrach (dluzszy bok = IMAGE_MAX_PX). */
export function imageSize(bbox: BoundingBox): { width: number; height: number } {
  const [west, south, east, north] = bbox;
  const latRad = (((south + north) / 2) * Math.PI) / 180;
  const widthM = (east - west) * Math.cos(latRad);
  const heightM = north - south;
  const scale = IMAGE_MAX_PX / Math.max(widthM, heightM, Number.EPSILON);

  return {
    width: Math.max(IMAGE_MIN_PX, Math.round(widthM * scale)),
    height: Math.max(IMAGE_MIN_PX, Math.round(heightM * scale)),
  };
}

const SCL_TEST = `[${HIDDEN_SCL.join(',')}].indexOf(s.SCL) < 0`;

/** Evalscript statystyk: wskaznik pola i maska pikseli bez chmur. */
export function statsEvalscript(index: VegetationIndex): string {
  const [a, b] = INDICES[index].bands;

  return `//VERSION=3
function setup() {
  return {
    input: [{ bands: ['${a}', '${b}', 'SCL', 'dataMask'] }],
    output: [{ id: 'index', bands: 1, sampleType: 'FLOAT32' }, { id: 'dataMask', bands: 1 }],
  };
}
function evaluatePixel(s) {
  var clear = s.dataMask === 1 && ${SCL_TEST};
  return { index: [(s.${a} - s.${b}) / (s.${a} + s.${b})], dataMask: [clear ? 1 : 0] };
}`;
}

/** Evalscript obrazu: wskaznik -> kolor na skali `low..high`, przezroczyste poza polem i pod chmura. */
export function imageEvalscript(low: number, high: number, index: VegetationIndex = 'ndvi'): string {
  const stops = [low, (low + high) / 2, high].map((value) => value.toFixed(4)).join(', ');
  const { bands, ramp } = INDICES[index];
  const [a, b] = bands;

  return `//VERSION=3
function setup() {
  return { input: [{ bands: ['${a}', '${b}', 'SCL', 'dataMask'] }], output: { bands: 4, sampleType: 'UINT8' } };
}
function evaluatePixel(s) {
  var value = (s.${a} - s.${b}) / (s.${a} + s.${b});
  var color = colorBlend(value, [${stops}], ${JSON.stringify(ramp)});
  var visible = s.dataMask === 1 && ${SCL_TEST};
  return [color[0], color[1], color[2], visible ? 235 : 0];
}`;
}

function dayRange(date: string): { from: string; to: string } {
  return { from: `${date}T00:00:00Z`, to: `${addDays(date, 1)}T00:00:00Z` };
}

export function createCopernicusImagerySource(
  credentials: CopernicusCredentials,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
  clock: () => number = Date.now,
  sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): VegetationImagerySource {
  const { clientId, clientSecret } = credentials;

  async function call(
    url: string,
    body: string,
    headers: Record<string, string>,
    attempt = 1,
  ): Promise<Response> {
    const response = await fetchImpl(url, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': OUTBOUND_USER_AGENT, ...headers },
      body,
    });

    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get('retry-after'));

      await sleep(Math.min(MAX_RETRY_MS, retryAfter > 0 ? retryAfter : DEFAULT_RETRY_MS * attempt));

      return call(url, body, headers, attempt + 1);
    }

    if (!response.ok) throw new Error(`Copernicus responded with HTTP ${response.status} (${url})`);

    return response;
  }

  async function token(id: string, secret: string): Promise<string> {
    const cached = tokens.get(id);

    if (cached && cached.expiresAt > clock()) return cached.token;

    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    });
    const response = await call(COPERNICUS_TOKEN_URL, form.toString(), {
      'content-type': 'application/x-www-form-urlencoded',
    });
    const body = record(await response.json());
    const accessToken = body.access_token;
    const expiresIn = num(body.expires_in) ?? 300;

    if (typeof accessToken !== 'string') throw new Error('Copernicus token response has no access_token');

    tokens.set(id, { token: accessToken, expiresAt: clock() + expiresIn * 1000 - TOKEN_MARGIN_MS });

    return accessToken;
  }

  function statsBody(geometry: PolygonGeometry, date: string, index: VegetationIndex): string {
    return JSON.stringify({
      input: {
        bounds: { geometry, properties: { crs: CRS84 } },
        data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }],
      },
      aggregation: {
        timeRange: dayRange(date),
        aggregationInterval: { of: 'P1D' },
        resx: STATS_RES_DEG,
        resy: STATS_RES_DEG,
        evalscript: statsEvalscript(index),
      },
      calculations: { default: { statistics: { default: { percentiles: { k: [5, 95] } } } } },
    });
  }

  function imageBody(part: VegetationImagePart, date: string, evalscript: string): string {
    return JSON.stringify({
      input: {
        bounds: { bbox: part.bbox, geometry: part.geometry, properties: { crs: CRS84 } },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: { timeRange: dayRange(date), mosaickingOrder: 'leastCC' },
            processing: { upsampling: 'BICUBIC' },
          },
        ],
      },
      output: {
        ...imageSize(part.bbox),
        responses: [{ identifier: 'default', format: { type: 'image/png' } }],
      },
      evalscript,
    });
  }

  return {
    async render(request: VegetationImageRequest): Promise<VegetationImage | null> {
      if (!clientId || !clientSecret) throw AppError.notConfigured('Copernicus Data Space credentials');

      try {
        const bearer = { authorization: `Bearer ${await token(clientId, clientSecret)}` };
        const json = { ...bearer, 'content-type': 'application/json', accept: 'application/json' };
        const from = addDays(request.date, -request.windowDays);
        const catalog = await call(
          COPERNICUS_CATALOG_URL,
          JSON.stringify({
            collections: ['sentinel-2-l2a'],
            bbox: unionBbox(request.parts.map((part) => part.bbox)),
            datetime: `${from}T00:00:00Z/${request.date}T23:59:59Z`,
            limit: 100,
            fields: {
              include: ['properties.datetime', 'properties.eo:cloud_cover'],
              exclude: ['assets', 'links'],
            },
          }),
          { ...json, accept: 'application/geo+json' },
        );
        const candidates = parseCatalog(await catalog.json()).slice(0, MAX_CANDIDATES);

        for (const scene of candidates) {
          // kandydaci po kolei (zwykle pierwszy wystarcza), dzialki sceny rownolegle
          const parts = await mapLimit(request.parts, MAX_PARALLEL, async (part) => {
            const response = await call(
              COPERNICUS_STATISTICS_URL,
              statsBody(part.geometry, scene.date, request.index),
              json,
            );

            return parseFieldStats(await response.json());
          });
          const stats = combineStats(parts);

          if (!stats || stats.clearShare < MIN_CLEAR_SHARE) continue;

          const scale = colorScale(stats);
          const evalscript = imageEvalscript(scale.low, scale.high, request.index);
          const tiles = await mapLimit(request.parts, MAX_PARALLEL, async (part) => {
            const image = await call(COPERNICUS_PROCESS_URL, imageBody(part, scene.date, evalscript), {
              ...bearer,
              'content-type': 'application/json',
              accept: 'image/png',
            });

            return { png: new Uint8Array(await image.arrayBuffer()), bbox: part.bbox };
          });

          return {
            tiles,
            sceneDate: scene.date,
            sceneCloudCover: scene.cloudCover,
            clearShare: stats.clearShare,
            low: scale.low,
            high: scale.high,
            mean: stats.mean,
          };
        }

        return null;
      } catch (error) {
        throw AppError.upstream('Copernicus Data Space', error);
      }
    },
  };
}
