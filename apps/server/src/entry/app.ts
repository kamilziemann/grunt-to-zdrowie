// Fabryka aplikacji Hono: middleware -> moduly -> OpenAPI (/openapi.json, /docs) -> bledy.
// Kontener jest wstrzykiwany (src/index.ts podaje createContainer z src/container.ts; testy moga podac faki).
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ServerVars } from '@app/env/server';
import { createErrorHandler, notFoundHandler, openApiValidationHook } from '@app/http/hono';
import type { Logger } from '@app/logger';

import { SERVER_NAME, SERVER_VERSION } from '../lib/version';
import type { AppEnv, ContainerFactory } from '../services/container';
import {
  contextMiddleware,
  corsMiddleware,
  envMiddleware,
  identityMiddleware,
  loggerMiddleware,
  requestIdMiddleware,
  rootLoggerFor,
  type LoggerMiddlewareOptions,
} from './middlewares';
import { mountRoutes } from './routes';
import { mountAuth } from './routes/auth';

/** Raport bledu 5xx do zewnetrznego narzedzia (Sentry); domyslnie brak - wystarczaja logi Cloudflare. */
export type ErrorReporter = (
  err: unknown,
  context: { requestId?: string; traceId?: string; path: string },
) => void;

export interface AppOptions {
  createContainer: ContainerFactory;
  logger?: LoggerMiddlewareOptions;
  reportError?: ErrorReporter;
}

const DOCS_HTML = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API - dokumentacja</title>
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

export function createApp(options: AppOptions) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook });

  app.use(requestIdMiddleware);
  app.use(loggerMiddleware(options.logger));
  app.use(envMiddleware);
  app.use(corsMiddleware);
  app.use(contextMiddleware(options.createContainer));
  app.use(identityMiddleware);

  app.onError((err, c) => {
    // vars moga nie istniec, jesli blad poleci przed envMiddleware (np. w requestId/logger)
    const vars: ServerVars | undefined = c.get('vars');
    const handler = createErrorHandler({
      getLogger: (ctx) => (ctx.get('logger') as Logger | undefined) ?? rootLoggerFor(c.env, options.logger),
      getRequestId: (ctx) => ctx.get('requestId'),
      // tresc nieoczekiwanych bledow (np. SQL i parametry z Drizzle) tylko lokalnie: preview jest publiczne
      exposeInternals: vars?.ENVIRONMENT === 'development',
      onServerError: (error, ctx) =>
        options.reportError?.(error, {
          requestId: ctx.get('requestId'),
          traceId: (ctx.get('trace') as AppEnv['Variables']['trace'] | undefined)?.traceId,
          path: ctx.req.path,
        }),
    });

    return handler(err, c);
  });
  app.notFound(notFoundHandler);

  mountAuth(app);

  const routes = mountRoutes(app);

  routes.doc31('/openapi.json', (c) => ({
    openapi: '3.1.0',
    info: {
      title: `${SERVER_NAME} API`,
      version: SERVER_VERSION,
      description:
        'Bledy: application/problem+json (RFC 9457) z polem `code` (PROBLEM_CODES z @app/contracts).',
    },
    servers: [{ url: c.get('vars').PUBLIC_URL }],
  }));

  routes.get('/docs', (c) => c.html(DOCS_HTML));

  return routes;
}

export type App = ReturnType<typeof createApp>;
