// Nakladka pamieci na zrodlo dzialek (ULDK z zapasem WFS): dzialka po numerze raz pobrana z GUGiK wraca z pamieci
// (D1) bez pytania GUGiK przez PARCEL_MEMORY_FRESH_DAYS dni. Starszy wpis odswiezamy, a gdy GUGiK nie odpowiada
// (nocny limit, przekierowanie, przerwa) - oddajemy stary wpis zamiast bledu. Pamiec jest tylko dodatkiem: jej
// awaria albo powolnosc nigdy nie psuje odczytu dzialki.
import type {
  ParcelMemoryStore,
  ParcelRecord,
  ParcelSource,
  StoredParcelRecord,
} from '../../domain/parcel-source';

/** Granice dzialek zmieniaja sie rzadko (podzial, scalenie) - miesiac to rozsadny kompromis swiezosci i limitow. */
export const PARCEL_MEMORY_FRESH_DAYS = 30;

/** Dluzej na odczyt pamieci nie czekamy - wtedy pytamy GUGiK jak bez pamieci. */
const MEMORY_READ_TIMEOUT_MS = 1500;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ParcelMemoryOptions {
  store: ParcelMemoryStore;
  now: () => string;
  /** zapis w tle (Workers: `waitUntil`), zeby odpowiedz nie czekala na D1; domyslnie zapis przed odpowiedzia */
  defer?: (task: Promise<unknown>) => void;
  /** blad pamieci (odczyt albo zapis) - do logu; odczyt dzialki idzie dalej */
  onError?: (error: unknown, operation: 'get' | 'put') => void;
  freshDays?: number;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`parcel memory: no answer in ${ms} ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function withParcelMemory(source: ParcelSource, options: ParcelMemoryOptions): ParcelSource {
  const { store, now, onError } = options;
  const freshMs = (options.freshDays ?? PARCEL_MEMORY_FRESH_DAYS) * DAY_MS;

  async function recall(id: string): Promise<StoredParcelRecord | null> {
    try {
      return await withTimeout(store.get(id), MEMORY_READ_TIMEOUT_MS);
    } catch (error) {
      onError?.(error, 'get');

      return null;
    }
  }

  async function remember(id: string, record: ParcelRecord): Promise<void> {
    const write = store
      .put(id, { ...record, fetchedAt: record.fetchedAt ?? now() })
      .catch((error: unknown) => onError?.(error, 'put'));

    if (options.defer) options.defer(write);
    else await write;
  }

  const isFresh = (entry: StoredParcelRecord): boolean =>
    Date.parse(now()) - Date.parse(entry.fetchedAt) < freshMs;

  return {
    async byId(id) {
      const entry = await recall(id);

      if (entry && isFresh(entry)) return entry;

      let record: ParcelRecord | null;

      try {
        record = await source.byId(id);
      } catch (error) {
        // lepsza granica sprzed miesiaca niz blad; `fetchedAt` mowi, z kiedy jest
        if (entry) return { ...entry, stale: true };

        throw error;
      }

      if (record) await remember(id, record);

      return record;
    },

    async byPoint(lng, lat) {
      const record = await source.byPoint(lng, lat);

      // dzialka wskazana na mapie trafia do pamieci pod swoim numerem - kolejna analiza po numerze juz z niej
      if (record) await remember(record.id, record);

      return record;
    },

    byName: (query, limit) => source.byName(query, limit),
  };
}
