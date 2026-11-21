// Telemetria przegladarki, montowana pod /telemetry: raporty bledow JS (@app/start-kit installClientErrorReporter).
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import { postClientError } from './telemetry.handlers';
import { reportClientError } from './telemetry.routes';

export const telemetryModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(
  reportClientError,
  postClientError,
);
