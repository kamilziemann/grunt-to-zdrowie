// Miesiace do wyboru dla obrazu z satelity: od biezacego wstecz do pierwszych scen Sentinel-2 nad Polska. Serwer
// szuka najczystszego zdjecia z 30 dni przed podanym dniem, wiec miesiac = jego ostatni dzien (biezacy = dzis).
import { APP_TIME_ZONE } from '@/lib/locale';

/** Pierwszy miesiac ze scenami Sentinel-2 L2A nad Polska (jak `FIRST_SCENE_DATE` serwera). */
export const FIRST_IMAGERY_MONTH = '2017-04';

/** Dzisiejsza data w Polsce jako RRRR-MM-DD. */
export function todayInPoland(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(now);
}

/** Miesiace RRRR-MM od biezacego (pierwszy) do `FIRST_IMAGERY_MONTH` (ostatni). */
export function imageryMonths(today: string): string[] {
  const months: string[] = [];
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));

  while (`${year}-${String(month).padStart(2, '0')}` >= FIRST_IMAGERY_MONTH) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;

    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return months;
}

/**
 * Dzien wysylany do API dla miesiaca RRRR-MM: ostatni dzien miesiaca; biezacy miesiac albo brak wyboru = undefined
 * (serwer bierze dzis).
 */
export function imageryDate(month: string | null, today: string): string | undefined {
  if (month === null || month >= today.slice(0, 7)) return undefined;

  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();

  return `${month}-${String(last).padStart(2, '0')}`;
}
