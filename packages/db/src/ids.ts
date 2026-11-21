// Identyfikatory: krotkie, czytelne w URL, z prefiksem rodzaju (np. par_x1y2...). Losowosc z crypto.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function randomSuffix(length = 12): string {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);
  let out = '';

  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];

  return out;
}

/** Id rekordu: `<prefiks>_<12 losowych znakow>`. Kazdy rodzaj rekordu ma wlasny, unikalny 3-literowy prefiks. */
export function createId(prefix: string): string {
  return `${prefix}_${randomSuffix()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
