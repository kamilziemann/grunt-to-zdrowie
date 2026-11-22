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
  /**
   * kiedy GUGiK oddal te granice (ISO 8601) - podaje go pamiec dzialek (infrastructure/parcel-memory);
   * brak = rekord prosto ze zrodla, pobrany teraz
   */
  fetchedAt?: string;
  /** rekord z pamieci starszy niz jej waznosc, oddany, bo GUGiK nie odpowiedzial */
  stale?: boolean;
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

/**
 * Pamiec dzialek pobranych z GUGiK (implementacja: repositories/parcel-records na D1). `fetchedAt` w rekordzie
 * mowi, kiedy GUGiK oddal granice. Klucz to identyfikator, o ktory pytano (zwykle rowny `record.id`).
 */
export interface ParcelMemoryStore {
  get(id: string): Promise<StoredParcelRecord | null>;
  put(id: string, record: StoredParcelRecord): Promise<void>;
}

export type StoredParcelRecord = ParcelRecord & { fetchedAt: string };

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

export interface RegistryLandUseOptions {
  /** dluzej na ewidencje nie czekamy - dzialka wraca bez uzytkow, zamiast wstrzymywac ekran */
  timeoutMs: number;
  /** rekord uzupelniony o uzytki (do zapamietania, zeby nastepny odczyt nie pytal ewidencji) */
  onEnriched?: (record: ParcelRecord) => void;
  /**
   * utrzymanie pracy w tle po odpowiedzi (Workers: `waitUntil`): gdy ewidencja odpowie po limicie, uzytki i tak
   * trafiaja do pamieci i nastepne wejscie na dzialke ma je od razu
   */
  defer?: (task: Promise<unknown>) => void;
}

/**
 * Dzialka po identyfikatorze z uzytkami z ewidencji: ULDK ich nie podaje, wiec rekord bez `landUse` dopytujemy
 * w rejestrze (WFS EGiB). Dzieki temu krok dzialki od razu mowi, ze dzialka to np. las. Rejestr jest dodatkiem:
 * jego brak, blad albo powolnosc oddaja rekord bez zmian (spozniona odpowiedz jest zapamietywana w tle). Odczyt pod
 * punktem (klik na mapie) zostaje szybki - bez dopytywania.
 */
export function withRegistryLandUse(
  source: ParcelSource,
  registry: ParcelRegistry,
  { timeoutMs, onEnriched, defer }: RegistryLandUseOptions,
): ParcelSource {
  const enrich = (record: ParcelRecord, entry: ParcelRegistryEntry): ParcelRecord => ({
    ...record,
    landUse: entry.landUse,
    ...(entry.registryAreaHa === undefined ? {} : { registryAreaHa: entry.registryAreaHa }),
  });

  return {
    async byId(id) {
      const record = await source.byId(id);

      if (!record || record.landUse) return record;

      let timer: ReturnType<typeof setTimeout> | undefined;
      let late = false;
      const lookup = registry.byId(record.id).catch(() => null);
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          late = true;
          resolve(null);
        }, timeoutMs);
      });

      // przeterminowany wpis (GUGiK nie odpowiadal) nie wraca do pamieci jako swiezy
      const remember = (entry: ParcelRegistryEntry | null) => {
        if (entry && !record.stale) onEnriched?.(enrich(record, entry));
      };

      // odpowiedz po limicie: ekran juz dostal dzialke bez uzytkow, ale pamiec dostanie je w tle
      defer?.(
        lookup.then((entry) => {
          if (late) remember(entry);

          return entry;
        }),
      );

      const entry = await Promise.race([lookup, timeout]);

      if (timer !== undefined) clearTimeout(timer);

      if (!entry) return record;

      remember(entry);

      return enrich(record, entry);
    },
    byPoint: (lng, lat) => source.byPoint(lng, lat),
    byName: (query, limit) => source.byName(query, limit),
  };
}
