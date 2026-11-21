import type { Job } from './job';

export interface JobRepository {
  all(): Job[];
}
