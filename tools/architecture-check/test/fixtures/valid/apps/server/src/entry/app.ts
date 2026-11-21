import { createErrorHandler } from '@fx/http/hono';
import { Hono } from 'hono';

import { createDb } from '../infrastructure/db';
import { jobsRoutes } from '../modules/jobs/routes';
import { createJobService } from '../services/jobs';

export const app = new Hono().route('/jobs', jobsRoutes(createJobService(createDb())));
export const onError = createErrorHandler;
