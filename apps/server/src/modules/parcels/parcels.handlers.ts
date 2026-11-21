// Cienkie handlery: walidacje wejscia robi OpenAPIHono, logika jest w services/parcels.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { getParcelAt, getParcelBoundaries, getParcelById, searchParcels } from './parcels.routes';

export const search: RouteHandler<typeof searchParcels, AppEnv> = async (c) =>
  c.json(await c.get('container').parcels.search(c.req.valid('query').q), 200);

export const byId: RouteHandler<typeof getParcelById, AppEnv> = async (c) =>
  c.json(await c.get('container').parcels.get(c.req.valid('query').id), 200);

export const at: RouteHandler<typeof getParcelAt, AppEnv> = async (c) => {
  const { lng, lat } = c.req.valid('query');

  return c.json(await c.get('container').parcels.at(lng, lat), 200);
};

export const boundaries: RouteHandler<typeof getParcelBoundaries, AppEnv> = async (c) => {
  const { x, y, z } = c.req.valid('query');

  return c.json(await c.get('container').parcels.boundaries(x, y, z), 200);
};
