import { RpcError } from '@app/rpc';
import { describe, expect, it } from 'vitest';

import { resolveAuthState, toAuthState } from './auth.queries';

const user = { id: 'u1', email: 'a@b.pl', name: 'Ala', roles: [] };

describe('stan auth', () => {
  it('wylaczone, anonim i zalogowany', () => {
    expect(toAuthState({ authEnabled: false, authenticated: false, user: null })).toEqual({
      kind: 'disabled',
    });
    expect(toAuthState({ authEnabled: true, authenticated: false, user: null })).toEqual({
      kind: 'anonymous',
    });
    expect(toAuthState({ authEnabled: true, authenticated: true, user }).kind).toBe('authenticated');
  });

  it('blad API = stan error (ochrona tras sie zamyka)', async () => {
    const failing = () =>
      Promise.reject(new RpcError({ type: 'about:blank', title: 'x', status: 503, code: 'upstream_failed' }));

    expect(await resolveAuthState(failing)).toMatchObject({
      kind: 'error',
      problem: { code: 'upstream_failed' },
    });
  });
});
