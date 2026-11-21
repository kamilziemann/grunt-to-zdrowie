// Handler `POST /telemetry/errors`: blad przegladarki trafia do logow Workera jako linia `client error` z tym samym
// traceId, co zapytania API tej odslony (naglowek `traceparent` raportu) - w Cloudflare Observability widac cala
// sciezke bledu. Nic nie zapisujemy w bazie; tresc ograniczaja limity schematu.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { reportClientError } from './telemetry.routes';

export const postClientError: RouteHandler<typeof reportClientError, AppEnv> = (c) => {
  const report = c.req.valid('json');
  const log = c.get('logger');
  const fields = { client: report, clientTraceId: report.traceId };

  if (report.kind === 'unhandledrejection') log.warn('client error', fields);
  else log.error('client error', fields);

  return c.body(null, 204);
};
