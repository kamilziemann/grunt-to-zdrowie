// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { isApiPath, toApiRequest } from './api-path';

describe('granica /api', () => {
  it('rozpoznaje tylko prefiks /api', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/articles')).toBe(true);
    expect(isApiPath('/apis')).toBe(false);
    expect(isApiPath('/articles')).toBe(false);
  });

  it('odcina prefiks, zachowuje query, metode i naglowki', async () => {
    const request = toApiRequest(
      new Request('https://example.com/api/search?q=zus', {
        method: 'POST',
        headers: { cookie: 'a=1' },
        body: 'x',
      }),
    );

    expect(request.url).toBe('https://example.com/search?q=zus');
    expect(request.method).toBe('POST');
    expect(request.headers.get('cookie')).toBe('a=1');
    expect(await request.text()).toBe('x');
    expect(toApiRequest(new Request('https://example.com/api')).url).toBe('https://example.com/');
  });
});
