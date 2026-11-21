// CORS: dodatkowe originy (ALLOWED_ORIGINS, lista po przecinku) + wlasny PUBLIC_URL. Inne originy nie dostaja naglowkow.
// AUTH_ENABLED=true dodaje `credentials: true` (ciasteczka sesji Better Auth).
import type { ServerVars } from '@app/env/server';
import type { Context, MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

import type { AppEnv } from '../../services/container';

export function allowedOrigins(vars: ServerVars): Set<string> {
  const origins = vars.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);

  try {
    origins.push(new URL(vars.PUBLIC_URL).origin);
  } catch {
    // PUBLIC_URL jest walidowany wczesniej; tu tylko defensywnie
  }

  return new Set(origins);
}

const corsOptions = {
  origin: (origin: string, c: Context) => {
    const vars = (c as Context<AppEnv>).get('vars');

    return allowedOrigins(vars).has(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // x-request-id + traceparent: korelacja logow stron i API (packages/logger, trace.ts)
  allowHeaders: ['content-type', 'x-request-id', 'traceparent'],
  exposeHeaders: ['x-request-id', 'x-trace-id', 'content-length', 'content-disposition', 'etag'],
  maxAge: 600,
};

const corsHandler = cors(corsOptions);
// Przy wlaczonym auth przegladarka wysyla ciasteczka sesji (fetch z `credentials: 'include'`): odpowiedz musi miec
// `Access-Control-Allow-Credentials: true` i konkretny origin (nigdy `*`; origin zwraca funkcja powyzej).
const corsCredentialsHandler = cors({ ...corsOptions, credentials: true });

export const corsMiddleware: MiddlewareHandler<AppEnv> = (c, next) =>
  (c.get('vars').AUTH_ENABLED ? corsCredentialsHandler : corsHandler)(c, next);
