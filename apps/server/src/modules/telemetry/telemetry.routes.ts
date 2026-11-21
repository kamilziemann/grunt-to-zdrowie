// Definicja trasy `POST /telemetry/errors` dla OpenAPI; handler w telemetry.handlers.ts.
import { createRoute } from '@hono/zod-openapi';
import { clientErrorReportSchema } from '@app/contracts';

import { jsonBody, validationFailed } from '../../lib/openapi';

export const reportClientError = createRoute({
  method: 'post',
  path: '/errors',
  tags: ['system'],
  summary: 'Raport bledu przegladarki (logi Cloudflare z traceId odslony strony)',
  request: { body: jsonBody(clientErrorReportSchema) },
  responses: { 204: { description: 'Przyjeto' }, 400: validationFailed },
});
