import { createRpcClient } from '@fx/rpc';
import type { AppType } from '@fx/server/types';

import { api } from '@/lib/api';

export type Client = ReturnType<typeof createRpcClient<AppType>>;
export const useJobs = (initial: unknown[]): unknown[] => [api, ...initial];
