// Adapter ForecastSource na MET Norway Locationforecast 2.0 (https://api.met.no/weatherapi/locationforecast/2.0/)
// - prognoza ECMWF do ok. 9 dni, CC BY 4.0. Odpowiedz to GeoJSON z `properties.timeseries[]`: stan chwilowy
// (`instant`) i sumy opadu na kolejne 1 albo 6 godzin (`next_1_hours`, `next_6_hours`; dalej w prognozie tylko 6 h).
// Doba to doba w Polsce. Regulamin: aplikacja przedstawia sie w User-Agent (kontakt: lib/user-agent),
// wspolrzedne maja najwyzej 4 miejsca po przecinku, odpowiedz wolno trzymac do naglowka Expires.
import type { SourceRef } from '@app/contracts';

import type { ForecastSeries, ForecastSource, Sourced } from '../../domain/analysis-ports';
import { hargreavesEt0 } from '../../domain/evapotranspiration';
import { addDays, isoDateInPoland } from '../../domain/iso-date';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';
import { failureNote, httpFailureNote } from '../../lib/source-note';

export const MET_NORWAY_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

const PROVIDER = 'MET Norway Locationforecast 2.0 (ECMWF)';
const LICENCE = 'CC BY 4.0 (Norwegian Meteorological Institute)';
const TIMEOUT_MS = 5000;
const HOUR_MS = 3_600_000;
/** doba wchodzi do prognozy, gdy sumy opadu pokrywaja wiekszosc jej godzin */
const MIN_COVERED_HOURS = 18;

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<Response>;

export interface MetNorwayOptions {
  fetch?: FetchLike;
  now?: () => string;
}

interface Step {
  time?: unknown;
  data?: {
    instant?: { details?: { air_temperature?: unknown } };
    next_1_hours?: { details?: { precipitation_amount?: unknown } };
    next_6_hours?: { details?: { precipitation_amount?: unknown } };
  };
}

interface DayAccumulator {
  precipMm: number;
  coveredHours: number;
  temps: number[];
}

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const round = (value: number): number => Number(value.toFixed(1));

export function metNorwayUrl([lng, lat]: [number, number]): string {
  return `${MET_NORWAY_URL}?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
}

/**
 * Sumy dobowe z kroków prognozy. Opad bierzemy z rozlacznych przedzialow: godzinowy, gdy jest, inaczej
 * 6-godzinny, i pomijamy kroki lezace w juz policzonym przedziale (inaczej opad liczylby sie podwojnie).
 */
export function parseForecast(
  body: unknown,
  from: string,
  days: number,
  latitude: number,
): ForecastSeries['days'] {
  const steps = (body as { properties?: { timeseries?: unknown } }).properties?.timeseries;

  if (!Array.isArray(steps)) throw new Error('MET Norway response has no properties.timeseries');

  const byDay = new Map<string, DayAccumulator>();
  let coveredUntil = Number.NEGATIVE_INFINITY;

  for (const step of steps as Step[]) {
    if (typeof step.time !== 'string') continue;

    const at = Date.parse(step.time);
    const date = isoDateInPoland(step.time);
    const day = byDay.get(date) ?? { precipMm: 0, coveredHours: 0, temps: [] };
    const temperature = finite(step.data?.instant?.details?.air_temperature);

    byDay.set(date, day);

    if (temperature !== null) day.temps.push(temperature);

    if (at < coveredUntil) continue;

    const hourly = finite(step.data?.next_1_hours?.details?.precipitation_amount);
    const sixHourly = finite(step.data?.next_6_hours?.details?.precipitation_amount);
    const [amount, hours] = hourly !== null ? [hourly, 1] : sixHourly !== null ? [sixHourly, 6] : [null, 0];

    if (amount === null) continue;

    day.precipMm += amount;
    day.coveredHours += hours;
    coveredUntil = at + hours * HOUR_MS;
  }

  return Array.from({ length: days }, (_unused, index) => addDays(from, index + 1)).flatMap((date) => {
    const day = byDay.get(date);

    if (!day || day.coveredHours < MIN_COVERED_HOURS || day.temps.length === 0) return [];

    const tMinC = Math.min(...day.temps);
    const tMaxC = Math.max(...day.temps);

    return [
      {
        date,
        precipMm: round(day.precipMm),
        // prognoza nie ma promieniowania - ET0 z temperatur (Hargreaves)
        et0Mm: round(hargreavesEt0({ date, latitude, tMinC, tMaxC })),
        tMinC: round(tMinC),
        tMaxC: round(tMaxC),
      },
    ];
  });
}

/** Chwila wydania prognozy (`properties.meta.updated_at`); null, gdy odpowiedz jej nie podaje. */
export function forecastIssuedAt(body: unknown): string | null {
  const updated = (body as { properties?: { meta?: { updated_at?: unknown } } }).properties?.meta?.updated_at;

  return typeof updated === 'string' && !Number.isNaN(Date.parse(updated)) ? updated : null;
}

export function createMetNorwayForecastSource({
  fetch: fetchImpl = (url, init) => fetch(url, init),
  now = () => new Date().toISOString(),
}: MetNorwayOptions = {}): ForecastSource {
  return {
    async forecast(point, from, days): Promise<Sourced<ForecastSeries>> {
      const url = metNorwayUrl(point);
      const base: SourceRef = {
        id: 'forecast',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        url,
        resolution: 'ok. 9 km',
        fetchedAt: now(),
      };
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': OUTBOUND_USER_AGENT, accept: 'application/json' },
      }).catch((error: unknown) => (error instanceof Error ? error : new Error('MET Norway request failed')));

      if (response instanceof Error) {
        return { data: null, source: { ...base, note: failureNote('MET Norway', response) } };
      }

      if (!response.ok) {
        return { data: null, source: { ...base, note: httpFailureNote('MET Norway', response.status) } };
      }

      const body: unknown = await response.json();
      const series = parseForecast(body, from, days, point[1]);
      const issuedAt = forecastIssuedAt(body);
      const first = series.at(0)?.date;
      const last = series.at(-1)?.date;

      if (first === undefined || last === undefined) {
        return { data: null, source: { ...base, note: `brak dni prognozy po ${from}` } };
      }

      return {
        data: { days: series, ...(issuedAt ? { issuedAt } : {}) },
        source: {
          ...base,
          status: series.length < days ? 'partial' : 'ok',
          dataFrom: first,
          dataTo: last,
          ...(series.length < days ? { note: `prognoza obejmuje ${series.length} z ${days} dni` } : {}),
        },
      };
    },
  };
}
