// Jak dlugo pamietac odpowiedz zrodla danych (infrastructure/response-cache): dane zamkniete w historii sie nie
// zmieniaja, a ostatnie dni dostawcy jeszcze uzupelniaja (NASA POWER - kilka dni opoznienia, Sentinel-2 - nowe
// sceny). Jedna polityka dla wszystkich adapterow, zeby "historia dlugo, biezace dni krotko" znaczylo to samo.
import { addDays } from '../iso-date';

/** dane konczace sie wczesniej niz tyle dni przed dzisiaj traktujemy jako zamkniete */
export const SETTLED_AFTER_DAYS = 10;
/** historia: 30 dni */
export const HISTORY_TTL_S = 30 * 24 * 3600;
/** ostatnie dni: 3 godziny */
export const RECENT_TTL_S = 3 * 3600;
/** dane bez daty (gleba z modelu) - jak historia */
export const STATIC_TTL_S = HISTORY_TTL_S;

/** Czas zycia odpowiedzi z danymi do `dataTo` (RRRR-MM-DD); `today` - dzien w Polsce. */
export function sourceCacheTtl(dataTo: string | null, today: string): number {
  if (dataTo === null) return 0;

  return dataTo < addDays(today, -SETTLED_AFTER_DAYS) ? HISTORY_TTL_S : RECENT_TTL_S;
}
