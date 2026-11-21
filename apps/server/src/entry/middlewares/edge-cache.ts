// Cache brzegowy (Workers Cache stoi PRZED Workerem i cache'uje kazda odpowiedz GET bez Cache-Control przez 2 h!)
// - privateByDefault: odpowiedz bez polityki dostaje `private, no-store` - nic prywatnego nie trafi do wspolnego cache'u,
// - publicCache: publiczny odczyt (np. tresci stron) z polityka i tagami z @app/cache,
// - purgeOnWrite: udana mutacja czysci tagi danych, ktore zmienila (zanim odpowiemy - autor zmiany po zapisie
//   widzi juz nowa strone).
import { cacheHeaders, type CachePolicyName } from '@app/cache';
import type { Context, MiddlewareHandler } from 'hono';

import type { AppEnv } from '../../services/container';

const READ_METHODS = new Set(['GET', 'HEAD']);

export const privateByDefault: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();

  if (!c.res.headers.has('cache-control')) c.res.headers.set('cache-control', 'private, no-store');
};

export function publicCache(
  policy: CachePolicyName,
  tags: (c: Context<AppEnv>) => string[] = () => [],
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    if (!READ_METHODS.has(c.req.method) || c.res.status !== 200 || c.res.headers.has('set-cookie')) return;

    const headers = cacheHeaders(policy, tags(c));

    for (const [name, value] of Object.entries(headers)) {
      // handler moze sam ustawic dluzsza polityke - tagi dopisujemy zawsze
      if (name === 'cache-control' && c.res.headers.has(name)) continue;
      c.res.headers.set(name, value);
    }
  };
}

export function purgeOnWrite(tags: readonly string[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    if (READ_METHODS.has(c.req.method) || c.res.status >= 400) return;

    await c.get('container').edgeCache.purge(tags);
  };
}
