// Cienki handler: odczyt zapisu robi services/analysis.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { getReport } from './reports.routes';

export const report: RouteHandler<typeof getReport, AppEnv> = async (c) =>
  c.json(await c.get('container').analysis.report(c.req.valid('param').id), 200);
