import { createRpcClient } from '@fx/rpc';

import { serverClient } from '@/lib/server/client';

export type LoadedJobs = unknown[];
export const loadJobs = async (): Promise<LoadedJobs> => [createRpcClient, serverClient];
