// Daty kalendarzowe RRRR-MM-DD bez stref czasowych: dzien w analizie to dzien w Polsce, a rachunki (dodaj dni,
// dzien roku, roznica) liczymy w UTC, zeby zmiana czasu nie przesuwala dat.
const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isoDate(year: number, month: number, day: number): string {
  return fromUtc(Date.UTC(year, month - 1, day));
}

/** Dzien z chwili ISO 8601 (np. z zegara serwera), liczony w strefie Europe/Warsaw. */
export function isoDateInPoland(instant: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));

  return parts;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Ta sama data w innym roku; 29 lutego przechodzi na 28 lutego. */
export function withYear(date: string, year: number): string {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const shifted = isoDate(year, month, day);

  return Number(shifted.slice(5, 7)) === month ? shifted : isoDate(year, month, day - 1);
}

export function addYears(date: string, years: number): string {
  return withYear(date, yearOf(date) + years);
}

/** Liczba dni od `from` do `to` (ujemna, gdy `to` jest wczesniej). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export function monthOf(date: string): number {
  return Number(date.slice(5, 7));
}

/** Dzien roku: 1 stycznia = 1. */
export function dayOfYear(date: string): number {
  return daysBetween(isoDate(yearOf(date), 1, 1), date) + 1;
}
