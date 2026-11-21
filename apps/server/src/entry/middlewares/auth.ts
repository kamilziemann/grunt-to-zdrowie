// Uwierzytelnianie (authN) w transporcie: tozsamosc z ciasteczka sesji -> c.var.identity, plus straznicy tras.
// Przy AUTH_ENABLED=false (domyslnie) nic nie dotyka bazy: identity = null, a `requireAuth()` PRZEPUSZCZA zapytania
// (aplikacja dziala bez kont; wlaczenie auth jest konfiguracja, nie przebudowa). Autoryzacja (authZ) to polityki
// z domain/authorization egzekwowane przez `authorize` (services/authorization) albo `requirePolicy` ponizej.
import { AUTH_BASE_PATH, createAuthPort, type AuthPort } from '@app/auth';
import { createDb } from '@app/db';
import type { RawServerEnv, ServerVars } from '@app/env/server';
import { AppError } from '@app/http';
import type { MiddlewareHandler } from 'hono';

import { isAuthenticated, type Policy } from '../../domain/authorization';
import type { AppEnv } from '../../services/container';
import { authorize } from '../../services/authorization';
import { allowedOrigins } from './cors';

/** Czy sciezka nalezy do handlera Better Auth (`/auth/*`): tam tozsamosci nie rozwiazujemy. */
export function isAuthPath(path: string): boolean {
  return path === AUTH_BASE_PATH || path.startsWith(`${AUTH_BASE_PATH}/`);
}

/**
 * Pelny adres handlera Better Auth (`https://.../api/auth`). Gdy baseURL ma sciezke, Better Auth traktuje go jako
 * gotowy adres auth i pomija `basePath` - wiec dokladamy `/auth` sami (API jest pod `/api` tego samego originu).
 */
export function authBaseUrl(vars: ServerVars): string {
  return `${(vars.AUTH_URL ?? vars.PUBLIC_URL).replace(/\/+$/, '')}${AUTH_BASE_PATH}`;
}

/** Port auth na ten request (baza z bindingu requestu); wymaga AUTH_ENABLED=true i AUTH_SECRET (walidacja w @app/env). */
export function authPortFor(env: RawServerEnv, vars: ServerVars): AuthPort {
  if (!vars.AUTH_ENABLED || vars.AUTH_SECRET === undefined) throw AppError.notConfigured('Authentication');

  return createAuthPort(createDb(env.DB), {
    secret: vars.AUTH_SECRET,
    baseUrl: authBaseUrl(vars),
    trustedOrigins: [...allowedOrigins(vars)],
    debug: vars.LOG_LEVEL === 'debug',
  });
}

/** Rozwiazuje sesje raz na request i wklada `identity` do kontekstu (null = brak sesji albo auth wylaczone). */
export const identityMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const vars = c.get('vars');

  c.set('identity', null);

  if (vars.AUTH_ENABLED && !isAuthPath(c.req.path)) {
    c.set('identity', await authPortFor(c.env, vars).resolveIdentity(c.req.raw.headers));
  }

  await next();
};

/**
 * Straznik trasy: wymaga polityki (authZ). 401 `unauthorized` bez tozsamosci, 403 `forbidden` gdy polityka odmawia.
 * Auth wylaczone = przepuszcza (nie ma kogo sprawdzac).
 */
export function requirePolicy(policy: Policy): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.get('vars').AUTH_ENABLED) authorize(policy, c.get('identity'));

    await next();
  };
}

/**
 * Straznik trasy: wymaga zalogowanego uzytkownika (401 `unauthorized`). Przy AUTH_ENABLED=false przepuszcza.
 * Uzycie: `app.use('/parcels/*', requireAuth())` przed zamontowaniem modulu (patrz entry/routes/index.ts).
 */
export const requireAuth = (): MiddlewareHandler<AppEnv> => requirePolicy(isAuthenticated);

/** Hosty lokalnego `wrangler dev` i testow; Worker w chmurze dostaje *.workers.dev albo wlasna domene. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Czy zapytanie przyszlo na adres lokalny (np. http://localhost:8787) - drugi warunek tras zespolu bez auth. */
function isLocalRequest(url: string): boolean {
  const { hostname } = new URL(url);

  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * Straznik tras zespolu (np. panel admina pod /admin/*): przy wlaczonym auth dziala jak `requirePolicy`. Przy
 * wylaczonym auth przepuszcza WYLACZNIE lokalnie: ENVIRONMENT=development i zapytanie na adres lokalny (lokalna praca bez kont,
 * ADR 0002). W preview/production, a takze gdy konfiguracja dev trafilaby na Workera w chmurze (deploy bez --env),
 * odmawia 503 `not_configured` - trasa, ktora zmienia dane, nie moze stac otworem tylko dlatego, ze nikt nie wlaczyl
 * kont. To celowo ostrzejsze niz `requirePolicy`.
 */
export function requireStaffPolicy(policy: Policy): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const vars = c.get('vars');

    if (vars.AUTH_ENABLED) authorize(policy, c.get('identity'));
    else if (vars.ENVIRONMENT !== 'development' || !isLocalRequest(c.req.url)) {
      throw new AppError(
        'not_configured',
        'Admin panel requires AUTH_ENABLED=true outside local development',
        {
          expose: true,
        },
      );
    }

    await next();
  };
}
