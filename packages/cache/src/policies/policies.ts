// Polityki cache: ile odpowiedz zyje na brzegu Cloudflare (Workers Cache) i w przegladarce. Brzeg dostaje
// `Cloudflare-CDN-Cache-Control` (zdejmowany przed klientem), przegladarka zwykly `Cache-Control`.
// Zasady z dokumentacji Workers Cache: `max-age` + `stale-while-revalidate` (s-maxage wylacza SWR), `stale-if-error`
// pokazuje ostatnia dobra wersje przy awarii, `private`/`no-store` = BYPASS. Przegladarka zawsze pyta brzeg
// (`max-age=0, must-revalidate`), wiec po purge nowa tresc widac od razu, a brzeg odpowiada z pamieci.
export interface CachePolicy {
  /** polityka brzegu; null = bez cache'u brzegowego */
  readonly edge: string | null;
  readonly browser: string;
}

const DAY = 86_400;
const BROWSER_REVALIDATE = 'public, max-age=0, must-revalidate';

function edge(maxAge: number): string {
  return `public, max-age=${maxAge}, stale-while-revalidate=${DAY}, stale-if-error=${DAY}`;
}

export const CACHE_POLICIES = {
  /**
   * Tresci zmieniane przez aplikacje (czyszczone tagami przy zapisie), wiec TTL moze byc dlugi - 10 min to tylko
   * siatka bezpieczenstwa, gdyby purge sie nie udal.
   */
  editorial: { edge: edge(600), browser: BROWSER_REVALIDATE },
  /** Dane publiczne odswiezane w tle (cron, Workflow) - bez purge z tla, wiec krotki TTL: 5 min. */
  publicData: { edge: edge(300), browser: BROWSER_REVALIDATE },
  /** Strony prawie statyczne (o nas, regulamin). */
  static: { edge: edge(DAY), browser: BROWSER_REVALIDATE },
  /** Dane uzytkownika, panele, mutacje: nigdy we wspolnym cache'u. */
  private: { edge: null, browser: 'private, no-store' },
} as const satisfies Record<string, CachePolicy>;

export type CachePolicyName = keyof typeof CACHE_POLICIES;
