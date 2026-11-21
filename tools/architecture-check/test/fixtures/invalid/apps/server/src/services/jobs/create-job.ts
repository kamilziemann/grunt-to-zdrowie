import type { Context } from 'hono'; // forbidden-modules: services bez hono (takze import type)
import { createDb } from '../../infrastructure/db'; // layers: services -> infrastructure
import { renderService } from '../render/render'; // siblings: nie przez index.ts
import { nowIso } from '../../lib/time';

export const createJobService = (c: Context): string => `${String(c)}${String(createDb)}${renderService.render()}${nowIso()}`;
