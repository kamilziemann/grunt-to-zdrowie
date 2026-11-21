import { describe, expect, it } from 'vitest';

import { forwardRequestHeaders } from './forwarded-headers';

const PARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

describe('forwardRequestHeaders', () => {
  it('przenosi sesje, IP i request id, a slad kontynuuje tym samym traceId', () => {
    const incoming = new Headers({
      cookie: 'a=1',
      'cf-connecting-ip': '203.0.113.7',
      'x-request-id': 'req-1',
      traceparent: PARENT,
      authorization: 'Bearer secret',
    });
    const out = forwardRequestHeaders(new Headers(), incoming);

    expect(out.get('cookie')).toBe('a=1');
    expect(out.get('cf-connecting-ip')).toBe('203.0.113.7');
    expect(out.get('x-request-id')).toBe('req-1');
    expect(out.get('traceparent')).toMatch(/^00-0af7651916cd43dd8448eb211c80319c-[0-9a-f]{16}-01$/);
    expect(out.get('traceparent')).not.toBe(PARENT);
    expect(out.has('authorization')).toBe(false);
  });

  it('nie nadpisuje naglowkow ustawionych przez wolajacego', () => {
    const out = forwardRequestHeaders(new Headers({ cookie: 'own=1' }), new Headers({ cookie: 'a=1' }));

    expect(out.get('cookie')).toBe('own=1');
  });
});
