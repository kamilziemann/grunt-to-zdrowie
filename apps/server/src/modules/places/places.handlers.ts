// Cienki handler: walidacje wejscia robi OpenAPIHono, logika jest w services/places.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { searchPlaces } from './places.routes';

export const search: RouteHandler<typeof searchPlaces, AppEnv> = async (c) =>
  c.json(await c.get('container').places.search(c.req.valid('query').q), 200);
