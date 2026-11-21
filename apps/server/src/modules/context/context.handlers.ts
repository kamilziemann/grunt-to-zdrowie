// Cienki handler: walidacje wejscia robi OpenAPIHono, logika jest w services/context.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { getContextTile } from './context.routes';

export const tile: RouteHandler<typeof getContextTile, AppEnv> = async (c) => {
  const { layer, x, y } = c.req.valid('query');

  return c.json(await c.get('container').context.tile(layer, x, y), 200);
};
