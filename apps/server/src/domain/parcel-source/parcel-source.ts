// Port zrodla dzialek ewidencyjnych. Implementacja: infrastructure/uldk (ULDK GUGiK); testy podaja zrodlo w pamieci.
// Zrodlo oddaje surowy opis i geometrie - bbox, srodek i powierzchnie dolicza serwis (domain/parcel-geometry).
import type { PolygonGeometry } from '../parcel-geometry';

export interface ParcelDescription {
  id: string;
  number: string;
  region: string;
  commune: string;
  county: string;
  voivodeship: string;
}

export type ParcelOrigin = 'uldk' | 'egib-wfs';

export interface ParcelRecord extends ParcelDescription {
  geometry: PolygonGeometry;
  /** ktore zrodlo oddalo rekord */
  origin: ParcelOrigin;
  /** klasouzytki i powierzchnia ewidencyjna (ha) - podaje je tylko WFS ewidencji, ULDK nie */
  landUse?: string[];
  registryAreaHa?: number;
}

/** Dane ewidencyjne dzialki, ktorych nie ma w ULDK: klasouzytki i powierzchnia ewidencyjna. */
export interface ParcelRegistryEntry {
  landUse: string[];
  registryAreaHa?: number;
}

/** Ewidencja gruntow po identyfikatorze dzialki (WFS EGiB); null = brak dzialki albo brak danych. */
export interface ParcelRegistry {
  byId(id: string): Promise<ParcelRegistryEntry | null>;
}

export interface ParcelMatches {
  /** ile dzialek pasuje wg zrodla */
  total: number;
  items: ParcelDescription[];
}

export interface ParcelSource {
  /** Dzialka po pelnym identyfikatorze; null = nie ma takiej. */
  byId(id: string): Promise<ParcelRecord | null>;
  /** Dzialka pod punktem WGS84; null = w tym miejscu nie ma dzialki. */
  byPoint(lng: number, lat: number): Promise<ParcelRecord | null>;
  /** Dzialki pasujace do "obreb numer" (bez geometrii), najwyzej `limit` pozycji. */
  byName(query: string, limit: number): Promise<ParcelMatches>;
}

/**
 * Zrodlo z zapasem: gdy podstawowe zawiedzie (blad, limit zapytan), dzialke po identyfikatorze i pod punktem
 * oddaje zapasowe. "Nie ma takiej dzialki" (null) to odpowiedz, nie awaria - zapasu wtedy nie pytamy.
 * Szukanie po nazwie obrebu umie tylko zrodlo podstawowe.
 */
export function withFallback(primary: ParcelSource, fallback: ParcelSource): ParcelSource {
  return {
    byId: (id) => primary.byId(id).catch(() => fallback.byId(id)),
    byPoint: (lng, lat) => primary.byPoint(lng, lat).catch(() => fallback.byPoint(lng, lat)),
    byName: (query, limit) => primary.byName(query, limit),
  };
}
