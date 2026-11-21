// Zapisane raporty analiz, montowane pod /reports.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './reports.handlers';
import * as routes from './reports.routes';

export const reportsModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  routes.getReport,
  handlers.report,
);
