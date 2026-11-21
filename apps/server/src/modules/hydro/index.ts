// Hydrografia BDOT10k do mapy, montowana pod /hydro: kafle rowow, ciekow, wod i mokradel.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './hydro.handlers';
import * as routes from './hydro.routes';

export const hydroModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  routes.getHydroTile,
  handlers.tile,
);
