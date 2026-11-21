import { app } from '@fx/server/types'; // type-only: musi byc import type
import { jobs } from '@fx/db/src/schema'; // deep-import

export const useJobs = (): unknown[] => [app, jobs];
