// Cienki handler: walidacje wejscia robi OpenAPIHono, logika jest w services/imagery.
import { parseParcelSelection } from '@app/contracts';
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { getVegetation } from './imagery.routes';

export const vegetation: RouteHandler<typeof getVegetation, AppEnv> = async (c) => {
  const { dzialki, data, warstwa } = c.req.valid('query');

  return c.json(
    await c.get('container').imagery.vegetation({
      parcelIds: parseParcelSelection(dzialki),
      date: data,
      layer: warstwa ?? 'condition',
    }),
    200,
  );
};
