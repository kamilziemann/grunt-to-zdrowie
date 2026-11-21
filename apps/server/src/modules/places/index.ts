// Miejsca (geokodowanie adresow), montowane pod /places: wyszukiwanie po adresie albo nazwie.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './places.handlers';
import * as routes from './places.routes';

export const placesModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  routes.searchPlaces,
  handlers.search,
);
