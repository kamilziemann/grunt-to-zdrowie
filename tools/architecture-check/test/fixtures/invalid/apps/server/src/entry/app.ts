import { Hono } from 'hono';

import { somethingFromWeb } from '@fx/web'; // type-only: server -> web nie jest w typeOnlyImports
import { jobsRoutes } from '../modules/jobs/routes';

export const app = new Hono().route('/jobs', jobsRoutes());
export const x = somethingFromWeb;
