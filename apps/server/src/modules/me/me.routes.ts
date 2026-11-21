// Definicja trasy `GET /me` dla OpenAPI: biezaca tozsamosc, takze przy wylaczonym auth.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse } from '../../lib/openapi';
import { meDto } from './me.schemas';

export const getMe = createRoute({
  method: 'get',
  path: '/',
  tags: ['auth'],
  summary: 'Biezaca tozsamosc (dziala tez przy wylaczonym auth)',
  responses: { 200: jsonResponse(meDto, 'Tozsamosc albo brak (`authenticated: false`)') },
});
