import { nowIso } from '../lib/time'; // layers: domain -> lib
import type { jobs } from '@fx/db'; // forbidden-modules: domain bez @fx/db

export interface Job {
  id: string;
  at: ReturnType<typeof nowIso>;
  table: typeof jobs;
}
