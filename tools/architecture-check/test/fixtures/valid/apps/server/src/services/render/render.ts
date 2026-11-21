import type { Job } from '../../domain/job';

export const renderService = { render: (id: string, at: string): string => `${id}@${at}` };
export type { Job };
