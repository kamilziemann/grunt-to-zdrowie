import { schema } from '@fx/db';
import { eq } from 'drizzle-orm';

import type { Job } from '../domain/job';
import type { JobRepository } from '../domain/ports';
import { nowIso } from '../lib/time';

export const createJobRepository = (): JobRepository => ({
  all: (): Job[] => [{ id: `${nowIso()}${String(eq)}${String(schema)}` }],
});
