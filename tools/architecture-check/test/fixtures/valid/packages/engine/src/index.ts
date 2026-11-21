import type { Job } from '@fx/contracts';

export * from './types';

export const createFilm = (job: Job): string => job.id;
