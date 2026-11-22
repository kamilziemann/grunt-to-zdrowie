// Logger per request (child z requestId, traceId/spanId, metoda, sciezka) + jedna linia podsumowania po odpowiedzi.
// Slad W3C: `traceparent` od wolajacego (warstwa stron albo inny Worker) albo nowy; ten Worker to odcinek-dziecko,
// wiec logi stron i API maja ten sam traceId. Odpowiedz niesie `x-trace-id` (do zgloszen bledow).
// Poziom bierze z surowego env (LOG_LEVEL), zeby logowac takze bledy walidacji srodowiska.
import {
  childTrace,
  createLogger,
  isLogLevel,
  type Logger,
  type LoggerOptions,
  parseTraceparent,
  TRACEPARENT_HEADER,
} from '@app/logger';
import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../../services/container';

export interface LoggerMiddlewareOptions {
  /** nadpisanie sinku/czasu (testy) */
  loggerOptions?: Pick<LoggerOptions, 'sink' | 'now'>;
}

export function rootLoggerFor(env: Record<string, unknown>, options: LoggerMiddlewareOptions = {}): Logger {
  const level = isLogLevel(env.LOG_LEVEL) ? env.LOG_LEVEL : 'info';

  return createLogger({ level, ...options.loggerOptions });
}

export function loggerMiddleware(options: LoggerMiddlewareOptions = {}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const trace = childTrace(parseTraceparent(c.req.header(TRACEPARENT_HEADER)));
    const logger = rootLoggerFor(c.env, options).child({
      requestId: c.get('requestId'),
      traceId: trace.traceId,
      spanId: trace.spanId,
      method: c.req.method,
      path: c.req.path,
    });

    c.set('trace', trace);
    c.set('logger', logger);
    c.header('x-trace-id', trace.traceId);
    const started = Date.now();

    await next();
    logger.info('request', { status: c.res.status, ms: Date.now() - started });
  };
}
