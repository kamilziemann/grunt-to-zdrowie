import { RpcError } from '@app/rpc';
import { describe, expect, it } from 'vitest';

import { shouldRetry } from './query-client';

const rpc = (status: number) =>
  new RpcError({ type: 'about:blank', title: 't', status, code: status === 404 ? 'not_found' : 'internal' });

describe('shouldRetry', () => {
  it('4xx bez ponowien, 5xx i siec do 2 razy', () => {
    expect(shouldRetry(0, rpc(404))).toBe(false);
    expect(shouldRetry(0, rpc(503))).toBe(true);
    expect(shouldRetry(2, rpc(503))).toBe(false);
    expect(shouldRetry(1, new TypeError('fetch failed'))).toBe(true);
  });
});
