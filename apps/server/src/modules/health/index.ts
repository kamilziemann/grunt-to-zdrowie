// Zdrowie API, montowane pod /health: nazwa, wersja i srodowisko serwisu dla strony startowej, monitoringu i testow.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import { getHealth } from './health.handlers';
import { health } from './health.routes';

export const healthModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  health,
  getHealth,
);
