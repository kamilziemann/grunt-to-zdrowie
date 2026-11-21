// Adapter ParcelSource na ULDK GUGiK (https://uldk.gugik.gov.pl/opis.html) - bezplatna usluga lokalizacji dzialek.
// Odpowiedz to tekst: pola rozdzielone "|", po jednej dzialce na linie. Dwie pulapki, ktore ten plik obsluguje:
// - bez `srid=4326` ULDK oddaje wspolrzedne w EPSG:2180, a punkt w GetParcelByXY wymaga ukladu w samym `xy`;
// - pierwsza linia znaczy co innego w zaleznosci od zapytania: w GetParcelById/ByXY to status ("0" albo "-1 opis"),
//   w GetParcelByIdOrNr to liczba znalezionych dzialek.
import { AppError } from '@app/http';

import { parseWktPolygon } from '../../domain/parcel-geometry';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';
import type {
  ParcelDescription,
  ParcelMatches,
  ParcelRecord,
  ParcelSource,
} from '../../domain/parcel-source';

export const ULDK_URL = 'https://uldk.gugik.gov.pl/';

const DESCRIPTION_FIELDS = 'id,voivodeship,county,commune,region,parcel';
// ULDK miewa chwilowe zaciecia (pojedyncze zapytanie wisi albo dostaje blad), a zwykle odpowiada w pol sekundy:
// krotki limit i jedno ponowienie daja odpowiedz szybciej niz jedno dlugie czekanie.
const TIMEOUT_MS = 6000;
const ATTEMPTS = 2;
// Szukanie po nazwie obrebu przeglada cala Polske i samo trwa ok. 6 s - dostaje jeden dlugi limit bez ponowien.
const NAME_SEARCH_TIMEOUT_MS = 25_000;

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; redirect: 'manual'; headers: Record<string, string> },
) => Promise<Response>;

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function parseDescription(fields: string[]): ParcelDescription | null {
  const [id, voivodeship, county, commune, region, number] = fields;

  if (!id || number === undefined) return null;

  return {
    id,
    number,
    region: region ?? '',
    commune: commune ?? '',
    county: county ?? '',
    voivodeship: voivodeship ?? '',
  };
}

/** Odpowiedz GetParcelById / GetParcelByXY: status w pierwszej linii, dzialka w drugiej. */
export function parseSingleParcel(text: string): ParcelRecord | null {
  const [status, row] = lines(text);

  if (status === undefined) throw new Error('empty ULDK response');

  if (status.startsWith('-1')) return null;

  if (status !== '0' || row === undefined) throw new Error(`unexpected ULDK status: ${status.slice(0, 80)}`);

  const fields = row.split('|');
  const description = parseDescription(fields);
  const geometry = parseWktPolygon(fields[6] ?? '');

  if (!description || !geometry) throw new Error('unreadable ULDK parcel row');

  return { ...description, geometry, origin: 'uldk' };
}

/** Odpowiedz GetParcelByIdOrNr: liczba trafien w pierwszej linii, potem po dzialce na linie. */
export function parseParcelMatches(text: string, limit: number): ParcelMatches {
  const [head, ...rows] = lines(text);

  if (head === undefined) throw new Error('empty ULDK response');

  if (head.startsWith('-1')) return { total: 0, items: [] };

  const items = rows
    .map((row) => parseDescription(row.split('|')))
    .filter((item): item is ParcelDescription => item !== null);
  const declared = Number.parseInt(head, 10);

  return {
    total: Math.max(Number.isFinite(declared) ? declared : 0, items.length),
    items: items.slice(0, limit),
  };
}

export function createUldkParcelSource(fetchImpl: FetchLike = (url, init) => fetch(url, init)): ParcelSource {
  async function call(
    params: Record<string, string>,
    { timeoutMs = TIMEOUT_MS, attempts = ATTEMPTS } = {},
  ): Promise<string> {
    const url = `${ULDK_URL}?${new URLSearchParams(params).toString()}`;

    let failure: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'manual',
          headers: { 'user-agent': OUTBOUND_USER_AGENT },
        });

        // Po przekroczeniu limitu zapytan (wieczorem 40/min na IP) ULDK odsyla przekierowanie na strone, ktora
        // przez 20 s nic nie zwraca. Nie idziemy za nim i nie ponawiamy - od razu oddajemy blad (i pole zapasowi).
        if (response.status >= 300 && response.status < 400) {
          failure = new Error('ULDK request limit reached (redirect)');

          break;
        }

        if (!response.ok) throw new Error(`ULDK responded with HTTP ${response.status}`);

        return await response.text();
      } catch (error) {
        failure = error;
      }
    }

    throw AppError.upstream('ULDK', failure);
  }

  async function single(params: Record<string, string>): Promise<ParcelRecord | null> {
    const text = await call({ ...params, result: `${DESCRIPTION_FIELDS},geom_wkt`, srid: '4326' });

    try {
      return parseSingleParcel(text);
    } catch (error) {
      throw AppError.upstream('ULDK', error);
    }
  }

  return {
    byId: (id) => single({ request: 'GetParcelById', id }),

    byPoint: (lng, lat) => single({ request: 'GetParcelByXY', xy: `${lng},${lat},4326` }),

    async byName(query, limit) {
      const text = await call(
        { request: 'GetParcelByIdOrNr', id: query, result: DESCRIPTION_FIELDS },
        { timeoutMs: NAME_SEARCH_TIMEOUT_MS, attempts: 1 },
      );

      try {
        return parseParcelMatches(text, limit);
      } catch (error) {
        throw AppError.upstream('ULDK', error);
      }
    },
  };
}
