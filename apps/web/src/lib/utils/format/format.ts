// Formatowanie dat dla UI wg jezyka interfejsu. Bez zaleznosci - Intl wystarcza.
import { APP_TIME_ZONE, DEFAULT_LOCALE, type AppLocale } from '@/lib/locale';

const INTL_TAGS: Record<AppLocale, string> = { pl: 'pl-PL', en: 'en-US' };

const formatters = new Map<AppLocale, Intl.DateTimeFormat>();

function dateTimeFormat(locale: AppLocale): Intl.DateTimeFormat {
  const cached = formatters.get(locale);

  if (cached) return cached;
  const created = new Intl.DateTimeFormat(INTL_TAGS[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  formatters.set(locale, created);

  return created;
}

/**
 * ISO -> „16 paź 2026, 12:30” (pl) / „Oct 16, 2026, 12:30 PM” (en) w czasie warszawskim (ten sam tekst na serwerze
 * i w przegladarce); brak daty -> „—”, niepoprawna -> oryginalny tekst.
 */
export function formatDateTime(iso: string | null | undefined, locale: AppLocale = DEFAULT_LOCALE): string {
  if (!iso) return '—';
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? iso : dateTimeFormat(locale).format(date);
}
