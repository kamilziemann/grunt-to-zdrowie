// Adapter MeteoSource na NASA POWER (https://power.larc.nasa.gov/docs/services/api/temporal/daily/) - dobowa
// pogoda dla punktu z reanalizy MERRA-2 (meteo, siatka 0,5 x 0,625 stopnia) i CERES/FLASHFlux (promieniowanie,
// siatka 1 stopien), bez konta i klucza. Jedno zapytanie oddaje 10 lat (ok. 2 s). Odpowiedz: JSON
// `properties.parameter[PARAMETR][RRRRMMDD]`; brak wartosci to `fill_value` (-999), a ostatnie dni (meteo 2-3,
// promieniowanie 5-7) sa zwykle jeszcze puste. ET0 liczy domain/evapotranspiration, nie zrodlo.
import type { SourceRef } from '@app/contracts';

import type { DailyWeather, MeteoSeries, MeteoSource, Sourced } from '../../domain/analysis-ports';
import { addDays, daysBetween } from '../../domain/iso-date';
import { hasMeaningfulGaps, isCompleteDay, meteoGaps } from '../../domain/meteo-gaps';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';
import { failureNote, httpFailureNote } from '../../lib/source-note';
import { sourceCacheTtl } from '../../domain/source-cache-policy';

export const NASA_POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';

const PROVIDER = 'NASA POWER (MERRA-2, CERES/FLASHFlux)';
const LICENCE = 'CC BY 4.0 (NASA Langley Research Center POWER Project)';
const RESOLUTION = 'meteo 0,5° × 0,625° (ok. 55 × 43 km), promieniowanie 1°';
/** bok komorki siatki meteo w km (0,5 stopnia szerokosci) */
const GRID_KM = 55;
const TIMEOUT_MS = 11_000;
const FILL_VALUE = -999;

/** Parametry profilu AG: opad mm/d, temperatury C, promieniowanie MJ/m2/d, wilgotnosc %, wiatr na 2 m w m/s. */
const PARAMETERS = {
  precipMm: 'PRECTOTCORR',
  tMeanC: 'T2M',
  tMaxC: 'T2M_MAX',
  tMinC: 'T2M_MIN',
  solarMjM2: 'ALLSKY_SFC_SW_DWN',
  humidityPct: 'RH2M',
  windMs: 'WS2M',
} as const;

type Field = keyof typeof PARAMETERS;

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<Response>;

export interface NasaPowerOptions {
  fetch?: FetchLike;
  /** chwila pobrania (ISO 8601) do `SourceRef.fetchedAt` */
  now?: () => string;
}

interface PowerResponse {
  geometry?: { coordinates?: unknown };
  header?: { fill_value?: unknown };
  properties?: { parameter?: Record<string, Record<string, unknown> | undefined> };
}

const compact = (date: string): string => date.replaceAll('-', '');

export function powerUrl([lng, lat]: [number, number], from: string, to: string): string {
  const params = new URLSearchParams({
    parameters: Object.values(PARAMETERS).join(','),
    community: 'AG',
    longitude: lng.toFixed(4),
    latitude: lat.toFixed(4),
    start: compact(from),
    end: compact(to),
    format: 'JSON',
    // doba czasu lokalnego (slonecznego), a nie UTC - opad i ekstrema temperatury trafiaja do wlasciwego dnia
    'time-standard': 'LST',
  });

  return `${NASA_POWER_URL}?${params.toString()}`;
}

/** Czas zycia odpowiedzi w pamieci (infrastructure/response-cache): z daty `end` zapytania. */
export function nasaPowerCacheTtl(today: () => string) {
  return (url: string): number => {
    const end = new URL(url).searchParams.get('end');
    const dataTo =
      end && /^\d{8}$/.test(end) ? `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6)}` : null;

    return sourceCacheTtl(dataTo, today());
  };
}

/**
 * Zamienia odpowiedz POWER na ciagla serie od `from` do `to`. Dni bez danych zostaja w serii z wartosciami null,
 * zeby obliczenia widzialy luke; status mowi, czy luki sa (`partial`) albo czy danych nie ma wcale (`missing`).
 */
export function parsePower(
  body: unknown,
  from: string,
  to: string,
): Omit<Sourced<MeteoSeries>, 'source'> & {
  status: SourceRef['status'];
  note?: string;
  dataFrom?: string;
  dataTo?: string;
} {
  const response = body as PowerResponse;
  const parameter = response.properties?.parameter;

  if (!parameter) throw new Error('NASA POWER response has no properties.parameter');

  const fill = typeof response.header?.fill_value === 'number' ? response.header.fill_value : FILL_VALUE;
  const value = (field: Field, key: string): number | null => {
    const raw = parameter[PARAMETERS[field]]?.[key];

    return typeof raw === 'number' && Number.isFinite(raw) && raw !== fill ? raw : null;
  };
  const days: DailyWeather[] = Array.from(
    { length: Math.max(0, daysBetween(from, to) + 1) },
    (_unused, i) => {
      const date = addDays(from, i);
      const key = compact(date);

      return {
        date,
        precipMm: value('precipMm', key),
        tMinC: value('tMinC', key),
        tMaxC: value('tMaxC', key),
        tMeanC: value('tMeanC', key),
        et0Mm: null,
        solarMjM2: value('solarMjM2', key),
        humidityPct: value('humidityPct', key),
        windMs: value('windMs', key),
      };
    },
  );
  const complete = days.filter(isCompleteDay);
  const first = complete.at(0)?.date;
  const last = complete.at(-1)?.date;

  if (complete.length === 0 || first === undefined || last === undefined) {
    return { data: null, status: 'missing', note: `brak danych dobowych pogody od ${from} do ${to}` };
  }

  // ostatnie dni, ktorych NASA POWER jeszcze nie wydala, to opoznienie publikacji - zrodlo jest wtedy "ok"
  const gaps = meteoGaps(days);
  const noSolar = complete.filter((day) => day.solarMjM2 === null).length;
  const notes = [
    gaps.lagDays > 0
      ? `ostatnie ${gaps.lagDays} dni NASA POWER jeszcze nie opublikowała (dane pojawiają się z kilkudniowym opóźnieniem) – w bilansie liczymy je bez deszczu`
      : null,
    gaps.gapDays > 0 ? `${gaps.gapDays} z ${days.length} dni bez opadu albo temperatury` : null,
    noSolar > 0
      ? `${noSolar} dni bez promieniowania słonecznego (parowanie policzone prostszym wzorem Hargreavesa)`
      : null,
  ].filter((note): note is string => note !== null);
  const coordinates = response.geometry?.coordinates;
  const elevation = Array.isArray(coordinates) ? coordinates[2] : undefined;

  return {
    data: {
      days,
      gridKm: GRID_KM,
      ...(typeof elevation === 'number' && Number.isFinite(elevation) ? { elevationM: elevation } : {}),
    },
    status: hasMeaningfulGaps(gaps) ? 'partial' : 'ok',
    ...(notes.length > 0 ? { note: notes.join('; ') } : {}),
    dataFrom: first,
    dataTo: last,
  };
}

export function createNasaPowerMeteoSource({
  fetch: fetchImpl = (url, init) => fetch(url, init),
  now = () => new Date().toISOString(),
}: NasaPowerOptions = {}): MeteoSource {
  return {
    async series(point, from, to) {
      const url = powerUrl(point, from, to);
      const base: SourceRef = {
        id: 'meteo',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        url,
        resolution: RESOLUTION,
        fetchedAt: now(),
      };
      // blad sieci albo HTTP to tez odpowiedz "brak danych" - orkiestrator nie musi znac szczegolow dostawcy
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': OUTBOUND_USER_AGENT, accept: 'application/json' },
      }).catch((error: unknown) => (error instanceof Error ? error : new Error('NASA POWER request failed')));

      if (response instanceof Error) {
        return { data: null, source: { ...base, note: failureNote('NASA POWER', response) } };
      }

      if (!response.ok) {
        return { data: null, source: { ...base, note: httpFailureNote('NASA POWER', response.status) } };
      }

      const { data, status, note, dataFrom, dataTo } = parsePower(await response.json(), from, to);

      return {
        data,
        source: {
          ...base,
          status,
          ...(note === undefined ? {} : { note }),
          ...(dataFrom === undefined ? {} : { dataFrom }),
          ...(dataTo === undefined ? {} : { dataTo }),
        },
      };
    },
  };
}
