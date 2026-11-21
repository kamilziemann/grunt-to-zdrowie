// Zapytania dzialek ewidencyjnych (TanStack Query): jedno zrodlo kluczy (`parcelsKeys`) i funkcji pobierajacych z
// /api/parcels. Dzialka zmienia sie rzadko, wiec odpowiedz jest swieza przez kilka minut (mniej zapytan do ULDK).
// Brak dzialki (404 z API) = null - komponent pokazuje wtedy wlasny komunikat zamiast bledu.
import type {
  HydroTile,
  Parcel,
  ParcelBoundaries,
  ParcelSearchResult,
  PlaceSearchResult,
} from '@app/contracts';
import { unwrap, unwrapOrNull } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';
import { fetchHydroTile } from '@/lib/hydro-map';

/** Co uzytkownik wskazal: identyfikator (z wyszukiwania) albo punkt na mapie. */
export type ParcelTarget = { kind: 'id'; id: string } | { kind: 'point'; lng: number; lat: number };

const STALE_MS = 5 * 60_000;
// Ponowien nie robimy w przegladarce: API samo ponawia zapytanie do ULDK, a blad ma przycisk "Sprobuj ponownie".
const POINT_DECIMALS = 6;

export const parcelsKeys = {
  all: ['parcels'] as const,
  detail: (id: string) => ['parcels', 'detail', id] as const,
  at: (lng: number, lat: number) => ['parcels', 'at', lng, lat] as const,
  search: (query: string) => ['parcels', 'search', query] as const,
  places: (query: string) => ['parcels', 'places', query] as const,
  boundaries: (x: number, y: number) => ['parcels', 'boundaries', x, y] as const,
  hydro: (x: number, y: number) => ['parcels', 'hydro', x, y] as const,
};

/** Punkt klikniecia zaokraglony do ok. 10 cm - stabilny klucz cache i adres bez szumu. */
export function pointTarget(lng: number, lat: number): ParcelTarget {
  const round = (value: number) => Number(value.toFixed(POINT_DECIMALS));

  return { kind: 'point', lng: round(lng), lat: round(lat) };
}

function fetchParcelById(id: string): Promise<Parcel | null> {
  return unwrapOrNull<Parcel>(getApi().parcels['by-id'].$get({ query: { id } }));
}

function fetchParcelAt(lng: number, lat: number): Promise<Parcel | null> {
  return unwrapOrNull<Parcel>(getApi().parcels.at.$get({ query: { lng: String(lng), lat: String(lat) } }));
}

/** GET /parcels/by-id - dzialka z geometria; null, gdy nie ma takiej. */
export const parcelQuery = (id: string) =>
  queryOptions({
    queryKey: parcelsKeys.detail(id),
    queryFn: () => fetchParcelById(id),
    staleTime: STALE_MS,
    retry: false,
  });

/**
 * Dzialka wskazana przez uzytkownika: po identyfikatorze (GET /parcels/by-id, ten sam klucz co `parcelQuery`) albo
 * pod punktem mapy (GET /parcels/at). `null` = nic nie wskazano - zapytanie jest wylaczone.
 */
export const parcelTargetQuery = (target: ParcelTarget | null) => {
  const queryKey: readonly (string | number)[] =
    target === null
      ? parcelsKeys.all
      : target.kind === 'id'
        ? parcelsKeys.detail(target.id)
        : parcelsKeys.at(target.lng, target.lat);

  return queryOptions({
    queryKey,
    queryFn: (): Promise<Parcel | null> => {
      if (target === null) return Promise.resolve(null);

      return target.kind === 'id' ? fetchParcelById(target.id) : fetchParcelAt(target.lng, target.lat);
    },
    enabled: target !== null,
    staleTime: STALE_MS,
    retry: false,
  });
};

/** GET /parcels/search - kandydaci (bez geometrii) po pelnym numerze albo "obreb numer". */
export const parcelSearchQuery = (query: string) =>
  queryOptions({
    queryKey: parcelsKeys.search(query),
    queryFn: (): Promise<ParcelSearchResult> =>
      unwrap<ParcelSearchResult>(getApi().parcels.search.$get({ query: { q: query } })),
    staleTime: STALE_MS,
    retry: false,
  });

/** GET /parcels/boundaries - obrysy i numery dzialek w kaflu siatki granic (warstwa granic na mapie). */
export const parcelBoundariesQuery = (x: number, y: number) =>
  queryOptions({
    queryKey: parcelsKeys.boundaries(x, y),
    queryFn: (): Promise<ParcelBoundaries> =>
      unwrap<ParcelBoundaries>(getApi().parcels.boundaries.$get({ query: { x: String(x), y: String(y) } })),
    // granice zmieniaja sie rzadko, a kafel bywa ciezki - trzymamy go dlugo
    staleTime: 6 * STALE_MS,
    retry: false,
  });

/**
 * GET /hydro/tile - rowy, cieki, wody i mokradla z BDOT10k w kaflu (warstwa "Rowy i cieki", mapa w raporcie).
 * Typowany klient z walidacja kontraktu i rozpoznaniem warstwy niedostepnej (zob. `fetchHydroTile`).
 */
export const hydroTileQuery = (x: number, y: number) =>
  queryOptions({
    queryKey: parcelsKeys.hydro(x, y),
    queryFn: ({ signal }): Promise<HydroTile> => fetchHydroTile(x, y, signal),
    // dane BDOT10k zmieniaja sie przy imporcie (raz na jakis czas) - kafel trzymamy dlugo
    staleTime: 6 * STALE_MS,
    retry: false,
  });

/** GET /places/search - miejsca po adresie albo nazwie; mapa dojezdza do wyniku, dzialke wskazuje uzytkownik. */
export const placeSearchQuery = (query: string) =>
  queryOptions({
    queryKey: parcelsKeys.places(query),
    queryFn: (): Promise<PlaceSearchResult> =>
      unwrap<PlaceSearchResult>(getApi().places.search.$get({ query: { q: query } })),
    staleTime: STALE_MS,
    retry: false,
  });
