import { Hono } from 'hono';
import { schema } from '@fx/db'; // forbidden-modules: modules bez @fx/db
import { renderRoutes } from '../render/routes'; // siblings: modules nigdy
import { createJobRepository } from '../../repositories/jobs'; // layers: modules -> repositories
export const lazyService = (): Promise<unknown> => import('../../services/jobs'); // dynamic-import

export const jobsRoutes = (): Hono => new Hono().get('/', (c) => c.json({ schema, renderRoutes, createJobRepository }));
