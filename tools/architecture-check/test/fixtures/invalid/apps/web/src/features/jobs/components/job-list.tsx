'use client';
import { loadJobs } from '../server/loader'; // server-client: 'use client' importuje serverOnly
import { useJobs } from '../hooks/use-jobs';

export const JobList = (): string => `${String(loadJobs)}${String(useJobs)}`;
