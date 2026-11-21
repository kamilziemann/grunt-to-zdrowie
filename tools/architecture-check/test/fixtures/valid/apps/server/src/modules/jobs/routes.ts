import { Hono } from 'hono';

import type { Job } from '../../domain/job';
import { nowIso } from '../../lib/time';
import type { JobService } from '../../services/jobs';

export const jobsRoutes = (service: JobService): Hono =>
  new Hono().get('/', (c) => c.json({ jobs: service.list() as Job[], at: nowIso() }));
