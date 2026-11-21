// Fabryka Better Auth: `createAuth(db, config)` buduje instancje na request (zero singletonu na poziomie modulu,
// bo `Db` wskazuje na binding D1 danego requestu). Email + haslo; schemat tabel zyje w @app/db (packages/db/src/schema.ts).
// Granica: ta paczka zna Better Auth i Drizzle; reszta systemu widzi tylko `Identity` z @app/contracts i `AuthPort`.
import { schema, type Db } from '@app/db';
import { betterAuth, type BetterAuthRateLimitOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export interface AuthConfig {
  /** sekret podpisujacy sesje i ciasteczka (AUTH_SECRET, min. 32 znaki) */
  secret: string;
  /** publiczny adres Workera API (AUTH_URL albo PUBLIC_URL); origin jest zawsze zaufany */
  baseUrl: string;
  /** dodatkowe zaufane originy (ALLOWED_ORIGINS): sprawdzane przy zapytaniach zmieniajacych stan */
  trustedOrigins?: string[];
  /** czy komunikaty/log maja byc glosne; false = tylko bledy */
  debug?: boolean;
}

/** Sciezka, pod ktora Worker montuje handler Better Auth (np. POST /auth/sign-in/email). */
export const AUTH_BASE_PATH = '/auth';

/**
 * Limit zapytan do `/auth/*` per IP (CF-Connecting-IP) i sciezka. Wlaczony JAWNIE: domyslnie Better Auth wlacza go
 * tylko przy `NODE_ENV=production` czytanym z `process.env` w runtime, a na Workers zadne srodowisko go nie ustawia
 * (bez tego logowanie przyjmowalo nieograniczona liczbe prob hasla). Liczniki w D1 (tabela `rate_limit`), bo pamiec
 * isolatu nie jest wspolna. Okna w sekundach; pozostale sciezki maja domyslne reguly Better Auth (np. zmiana hasla
 * 3/10 s, reset hasla 3/60 s, reszta 100/10 s). Rejestracja: 10 na godzine, nie mniej, bo za jednym IP (CGNAT
 * operatorow komorkowych) bywa wielu uzytkownikow.
 */
export const AUTH_RATE_LIMIT = {
  enabled: true,
  storage: 'database',
  window: 10,
  max: 100,
  customRules: {
    '/sign-in/email': { window: 60, max: 5 },
    '/sign-up/email': { window: 3600, max: 10 },
  },
} as const satisfies BetterAuthRateLimitOptions;

export function createAuth(db: Db, config: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    secret: config.secret,
    baseURL: config.baseUrl,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: config.trustedOrigins ?? [],
    rateLimit: AUTH_RATE_LIMIT,
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        // Role nadaje backend (np. skrypt/panel admina), nigdy klient: `input: false` blokuje je przy rejestracji.
        roles: { type: 'string[]', required: false, defaultValue: [], input: false },
      },
    },
    advanced: {
      // Na Cloudflare prawdziwy adres klienta jest w naglowku CF-Connecting-IP (rate limit, ip w sesji).
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    logger: { level: config.debug === true ? 'debug' : 'error' },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth['$Infer']['Session'];
export type AuthUser = AuthSession['user'];
