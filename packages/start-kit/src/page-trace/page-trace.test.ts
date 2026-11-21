import { describe, expect, it } from 'vitest';

import { getPageTrace, pageTraceHeaders } from './page-trace';

describe('slad odslony', () => {
  it('jeden traceId na odslone, nowy odcinek na zapytanie', () => {
    const { traceId } = getPageTrace();
    const first = pageTraceHeaders();
    const second = pageTraceHeaders();

    expect(first.traceparent).toContain(traceId);
    expect(second.traceparent).toContain(traceId);
    expect(first.traceparent).not.toBe(second.traceparent);
    expect(first['x-request-id']).not.toBe(second['x-request-id']);
  });
});
