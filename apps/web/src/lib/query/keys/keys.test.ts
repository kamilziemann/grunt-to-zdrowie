import { QueryClient, hashKey } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { queryKeys } from './keys';

describe('queryKeys', () => {
  it('są stabilne: to samo wywołanie daje ten sam hash', () => {
    expect(hashKey(queryKeys.auth.me())).toBe(hashKey(queryKeys.auth.me()));
  });

  it('unieważnienie klucza "all" obejmuje domenę i nie rusza innych', async () => {
    const client = new QueryClient();

    client.setQueryData(queryKeys.auth.me(), { authEnabled: false });
    client.setQueryData(queryKeys.health, { ok: true });

    await client.invalidateQueries({ queryKey: queryKeys.auth.all, refetchType: 'none' });

    expect(client.getQueryState(queryKeys.auth.me())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.health)?.isInvalidated).toBe(false);
  });
});
