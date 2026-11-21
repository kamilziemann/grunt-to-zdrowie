// Tagi cache (naglowek `Cache-Tag`): jedno zrodlo nazw dla stron i API. Odpowiedz niesie wszystkie tagi danych, z
// ktorych powstala, a mutacja po zmianie czysci tagi tego, co zmienila (`cache.purge({ tags })`). Kazda odpowiedz
// dostaje tez SITE_TAG - awaryjne „wyczysc wszystko”. Wartosci sa ASCII (Cloudflare odrzuca reszte bez bledu).
export const SITE_TAG = 'site';

const MAX_TAG_LENGTH = 1024;

/** Identyfikator w tagu: slug/id jest juz ASCII, ale kodujemy na wypadek polskich znakow w danych. */
function part(value: string | number): string {
  return encodeURIComponent(String(value).toLowerCase());
}

export const cacheTags = {
  /** Odczyty dzialek ewidencyjnych (ULDK) - wspolny tag do awaryjnego wyczyszczenia. */
  parcels: () => 'parcels',
  /** Wyniki geokodowania adresow. */
  places: () => 'places',
  /** Kafle hydrografii BDOT10k (zmieniaja sie tylko po ponownym imporcie). */
  hydro: () => 'hydro',
  /** Strona prawie statyczna po slugu (o nas, regulamin). */
  page: (slug: string) => `page:${part(slug)}`,
} as const;

/** Tag poprawny dla Cloudflare: drukowalne ASCII bez przecinka, do 1024 znakow. */
export function isValidTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= MAX_TAG_LENGTH && /^[\x21-\x7e]+$/.test(tag) && !tag.includes(',');
}

/** Lista do naglowka: SITE_TAG + podane, bez duplikatow i niepoprawnych wartosci. */
export function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set([SITE_TAG, ...tags.map((tag) => tag.toLowerCase())])].filter(isValidTag);
}
