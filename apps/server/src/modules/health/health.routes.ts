// Definicja trasy `GET /health` dla OpenAPI; handler w health.handlers.ts.
import { createRoute } from '@hono/zod-openapi';
import { healthSchema } from '@app/contracts';

import { jsonResponse } from '../../lib/openapi';

export const health = createRoute({
  method: 'get',
  path: '/',
  tags: ['system'],
  summary: 'Stan serwisu',
  responses: { 200: jsonResponse(healthSchema, 'Serwis dziala') },
});
