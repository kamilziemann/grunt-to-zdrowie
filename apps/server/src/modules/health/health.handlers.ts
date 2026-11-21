// Handler `GET /health`: nazwa i wersja serwisu dla monitoringu i testow dymnych (bez zaleznosci od bazy).
import type { RouteHandler } from '@hono/zod-openapi';

import { SERVER_NAME, SERVER_VERSION } from '../../lib/version';
import type { AppEnv } from '../../services/container';
import type { health } from './health.routes';

export const getHealth: RouteHandler<typeof health, AppEnv> = (c) =>
  c.json(
    {
      ok: true as const,
      service: SERVER_NAME,
      version: SERVER_VERSION,
      environment: c.get('vars').ENVIRONMENT,
      time: new Date().toISOString(),
    },
    200,
  );
