// Cienki handler: walidacje wejscia robi OpenAPIHono, cala logika jest w services/analysis.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { analyzeField } from './analysis.routes';

export const analyze: RouteHandler<typeof analyzeField, AppEnv> = async (c) =>
  c.json(await c.get('container').analysis.analyze(c.req.valid('json')), 200);
