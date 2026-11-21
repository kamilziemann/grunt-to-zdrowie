// Buduje kontener (serwisy + repozytoria + infrastruktura) na request i wklada go do c.var.container.
import type { MiddlewareHandler } from 'hono';

import type { AppEnv, ContainerFactory } from '../../services/container';

export function contextMiddleware(createContainer: ContainerFactory): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    let waitUntil: (promise: Promise<unknown>) => void;

    try {
      const executionCtx = c.executionCtx;

      waitUntil = (promise) => executionCtx.waitUntil(promise);
    } catch {
      // brak ExecutionContext (np. app.request() w testach bez ctx): praca w tle leci "na zywiol"
      waitUntil = (promise) => {
        void promise;
      };
    }

    c.set(
      'container',
      createContainer({ env: c.env, vars: c.get('vars'), logger: c.get('logger'), waitUntil }),
    );
    await next();
  };
}
