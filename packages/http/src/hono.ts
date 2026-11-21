// Adapter Hono: centralny error handler, 404 i hook walidacji dla @hono/zod-openapi.
// Importowany tylko przez apps/server/src/entry (transport). Reszta serwera zna tylko AppError.
import type { ProblemDetails } from '@app/contracts';
import type { Logger } from '@app/logger';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodError } from 'zod';

import { AppError, toProblem } from './app-error';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export function problemResponse(c: Context, problem: ProblemDetails): Response {
  return c.newResponse(JSON.stringify(problem), problem.status as ContentfulStatusCode, {
    'content-type': PROBLEM_CONTENT_TYPE,
  });
}

export interface ErrorHandlerOptions {
  /** logger per request (z contextu) albo staly */
  getLogger?: (c: Context) => Logger | undefined;
  getRequestId?: (c: Context) => string | undefined;
  exposeInternals: boolean;
  /** wolane dla bledow 5xx (np. raport do Sentry); nie moze rzucac */
  onServerError?: (err: unknown, c: Context) => void;
}

export function createErrorHandler(options: ErrorHandlerOptions): ErrorHandler {
  return (err, c) => {
    const requestId = options.getRequestId?.(c);
    const problem = toProblem(err, {
      instance: c.req.path,
      exposeInternals: options.exposeInternals,
      requestId,
    });
    const log = options.getLogger?.(c);

    if (log) {
      const data = {
        code: problem.code,
        status: problem.status,
        path: c.req.path,
        method: c.req.method,
        err,
      };

      if (problem.status >= 500) log.error('request failed', data);
      else log.warn('request rejected', data);
    }

    if (problem.status >= 500) options.onServerError?.(err, c);

    return problemResponse(c, problem);
  };
}

export const notFoundHandler: NotFoundHandler = (c) =>
  problemResponse(
    c,
    toProblem(AppError.notFound('Route', `${c.req.method} ${c.req.path}`), { instance: c.req.path }),
  );

/** defaultHook dla OpenAPIHono: bledy walidacji Zod -> Problem Details 400 z lista issues. */
export function openApiValidationHook(
  result: { success: boolean; error?: ZodError },
  c: Context,
): Response | undefined {
  if (result.success || !result.error) return undefined;

  return problemResponse(c, toProblem(AppError.fromZod(result.error), { instance: c.req.path }));
}
