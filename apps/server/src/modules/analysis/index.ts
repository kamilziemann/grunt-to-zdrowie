// Analiza wodna pola, montowana pod /analysis: jedno zadanie = jeden raport.
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import * as handlers from './analysis.handlers';
import * as routes from './analysis.routes';

export const analysisModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  routes.analyzeField,
  handlers.analyze,
);
