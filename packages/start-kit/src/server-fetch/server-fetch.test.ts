import { describe, expect, it } from 'vitest';

import { getServerFetch, registerServerFetch } from './server-fetch';

describe('rejestr API w procesie', () => {
  it('zwraca zarejestrowana funkcje', async () => {
    registerServerFetch(async () => new Response('ok'));
    expect(await (await getServerFetch()(new Request('http://x/'))).text()).toBe('ok');
  });
});
