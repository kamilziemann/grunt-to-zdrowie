// Walidacja zmiennych Workera (parseServerVars) raz na obiekt env (ten sam izolat = ten sam obiekt), nie na request.
// Zle srodowisko = 503 not_configured z lista brakujacych zmiennych (patrz .dev.vars.example).
import { parseServerVars, type ServerVars } from '@app/env/server';
import { AppError } from '@app/http';
import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../../services/container';

const cache = new WeakMap<object, ServerVars>();

export function resolveServerVars(env: Record<string, unknown>): ServerVars {
  const cached = cache.get(env);

  if (cached) return cached;

  try {
    const vars = parseServerVars(env);

    cache.set(env, vars);

    return vars;
  } catch (cause) {
    throw new AppError(
      'not_configured',
      cause instanceof Error ? cause.message : 'Invalid server environment',
      {
        cause,
        expose: true,
      },
    );
  }
}

export const envMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('vars', resolveServerVars(c.env));
  await next();
};
