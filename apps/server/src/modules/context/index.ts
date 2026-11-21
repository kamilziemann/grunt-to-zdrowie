// Otoczenie pola z BDOT10k do mapy, montowane pod /context: kafle drzew, sieci wodnej i obszarow chronionych.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './context.handlers';
import * as routes from './context.routes';

export const contextModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  routes.getContextTile,
  handlers.tile,
);
