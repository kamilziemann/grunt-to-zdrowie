import { describe, expect, it } from 'vitest';

import { childTrace, formatTraceparent, parseTraceparent, propagationHeaders } from './trace';

const PARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('traceparent', () => {
  it('parsuje poprawny naglowek i odrzuca zly albo zerowy', () => {
    expect(parseTraceparent(PARENT)).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      sampled: true,
    });
    expect(parseTraceparent('nope')).toBeNull();
    expect(parseTraceparent(undefined)).toBeNull();
    expect(parseTraceparent(`00-${'0'.repeat(32)}-00f067aa0ba902b7-01`)).toBeNull();
  });

  it('dziecko zachowuje traceId, ma nowy spanId; brak rodzica = nowy slad', () => {
    const parent = parseTraceparent(PARENT);
    const child = childTrace(parent);

    expect(child.traceId).toBe(parent?.traceId);
    expect(child.spanId).not.toBe(parent?.spanId);
    expect(childTrace(null).traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('naglowki propagacji: requestId + traceparent dziecka', () => {
    const parent = childTrace(null);
    const headers = propagationHeaders('req-1', parent);

    expect(headers['x-request-id']).toBe('req-1');
    expect(parseTraceparent(headers.traceparent)?.traceId).toBe(parent.traceId);
    expect(formatTraceparent(parent)).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});
