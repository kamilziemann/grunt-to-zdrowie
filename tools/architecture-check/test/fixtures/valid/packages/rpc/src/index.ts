import type { Job } from '@fx/contracts';
import { hc } from 'hono/client';

export const createRpcClient = hc;
export type { Job };
