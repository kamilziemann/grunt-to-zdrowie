// Cienki handler: walidacje wejscia robi OpenAPIHono, logika jest w services/hydro.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { getHydroTile } from './hydro.routes';

export const tile: RouteHandler<typeof getHydroTile, AppEnv> = async (c) => {
  const { x, y } = c.req.valid('query');

  return c.json(await c.get('container').hydro.tile(x, y), 200);
};
