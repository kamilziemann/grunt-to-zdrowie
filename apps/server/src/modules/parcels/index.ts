// Dzialki ewidencyjne, montowane pod /parcels: wyszukiwanie, dzialka po identyfikatorze i pod punktem mapy.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './parcels.handlers';
import * as routes from './parcels.routes';

export const parcelsModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook })
  .openapi(routes.searchParcels, handlers.search)
  .openapi(routes.getParcelById, handlers.byId)
  .openapi(routes.getParcelAt, handlers.at)
  .openapi(routes.getParcelBoundaries, handlers.boundaries);
