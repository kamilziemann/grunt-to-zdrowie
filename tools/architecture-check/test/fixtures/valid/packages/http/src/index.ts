import type { Job } from '@fx/contracts';
import { log } from '@fx/logger';

export class AppError extends Error {
  job?: Job;
}
export const warn = log;
