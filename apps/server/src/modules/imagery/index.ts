// Obrazy pola z satelity (pokaz trybu 3D), montowane pod /imagery: kondycja roslin wybranych dzialek.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './imagery.handlers';
import * as routes from './imagery.routes';

export const imageryModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  routes.getVegetation,
  handlers.vegetation,
);
