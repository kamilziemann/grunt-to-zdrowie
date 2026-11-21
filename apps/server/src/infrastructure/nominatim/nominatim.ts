// Adapter PlaceSource na Nominatim (geokoder OpenStreetMap, dane ODbL). Zasady uslugi publicznej: aplikacja
// przedstawia sie w User-Agent, najwyzej ok. 1 zapytanie na sekunde i wyniki w cache - stad cache brzegowy na trasie.
// Szukamy tylko w Polsce, po polsku.
import { AppError } from '@app/http';

import type { PlaceRecord, PlaceSource } from '../../domain/place-source';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const TIMEOUT_MS = 8000;
/** Punkt adresowy nie ma zasiegu: mapa dojezdza do okna ok. 250 m, w ktorym widac sasiednie dzialki. */
const POINT_MARGIN_DEG = 0.0012;

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<Response>;

interface NominatimItem {
  place_id?: unknown;
  lat?: unknown;
  lon?: unknown;
  name?: unknown;
  display_name?: unknown;
  boundingbox?: unknown;
  address?: Record<string, unknown> | null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function firstOf(address: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(address[key]);

    if (value !== '') return value;
  }

  return '';
}

function describe(item: NominatimItem): { label: string; detail: string } {
  const address = item.address ?? {};
  const locality = firstOf(address, ['city', 'town', 'village', 'hamlet', 'municipality']);
  const road = firstOf(address, ['road', 'pedestrian', 'residential']);
  const house = text(address.house_number);
  const street = [road, house].filter((part) => part !== '').join(' ');
  // adres na wsi bez ulic: "Dabrowa 12"
  const label = street !== '' ? street : [locality, house].filter((part) => part !== '').join(' ');
  const detail = [
    street !== '' ? locality : '',
    text(address.municipality),
    text(address.county),
    text(address.state),
  ]
    .filter((part, index, parts) => part !== '' && parts.indexOf(part) === index && part !== label)
    .join(', ');

  return { label: label !== '' ? label : text(item.name) || text(item.display_name), detail };
}

export function parsePlaces(body: unknown): PlaceRecord[] {
  if (!Array.isArray(body)) throw new Error('Nominatim response is not a list');

  return (body as NominatimItem[]).flatMap((item): PlaceRecord[] => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    // Nominatim: [poludnie, polnoc, zachod, wschod] jako napisy
    const box = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : [];
    const [south = lat, north = lat, west = lng, east = lng] = box.every(Number.isFinite) ? box : [];

    return [
      {
        id:
          typeof item.place_id === 'number' || typeof item.place_id === 'string'
            ? String(item.place_id)
            : `${lng},${lat}`,
        ...describe(item),
        center: [lng, lat],
        bbox: [
          Math.min(west, lng - POINT_MARGIN_DEG),
          Math.min(south, lat - POINT_MARGIN_DEG),
          Math.max(east, lng + POINT_MARGIN_DEG),
          Math.max(north, lat + POINT_MARGIN_DEG),
        ],
      },
    ];
  });
}

export function createNominatimPlaceSource(
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): PlaceSource {
  return {
    async search(query, limit) {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        countrycodes: 'pl',
        addressdetails: '1',
        'accept-language': 'pl',
        limit: String(limit),
      });

      try {
        const response = await fetchImpl(`${NOMINATIM_URL}?${params.toString()}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'user-agent': OUTBOUND_USER_AGENT, accept: 'application/json' },
        });

        if (!response.ok) throw new Error(`Nominatim responded with HTTP ${response.status}`);

        return parsePlaces(await response.json());
      } catch (error) {
        throw AppError.upstream('Nominatim', error);
      }
    },
  };
}
