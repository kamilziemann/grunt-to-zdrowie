import type { Job } from '../../domain/job';
import type { JobRepository } from '../../domain/ports';
import { nowIso } from '../../lib/time';
import { renderService } from '../render';

export interface JobService {
  list(): Job[];
  render(id: string): string;
}

export const createJobService = (repo: JobRepository): JobService => ({
  list: () => repo.all(),
  render: (id) => renderService.render(id, nowIso()),
});
