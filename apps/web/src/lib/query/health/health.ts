// Zapytanie o stan API (`GET /api/health`) przez typowany klient RPC.
import type { Health } from '@app/contracts';
import { unwrap } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';

import { queryKeys } from '../keys';

export const healthQuery = () =>
  queryOptions({
    queryKey: queryKeys.health,
    queryFn: (): Promise<Health> => unwrap<Health>(getApi().health.$get()),
  });
