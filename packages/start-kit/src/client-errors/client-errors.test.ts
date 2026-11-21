import { clientErrorReportSchema } from '@app/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createClientErrorReporter } from './client-errors';

describe('createClientErrorReporter', () => {
  it('wysyla poprawny raport z traceId odslony i bez powtorzen', () => {
    const send = vi.fn<(url: string, body: string) => void>();
    const report = createClientErrorReporter({ endpoint: '/api/telemetry/errors', release: 'abc' }, send);

    report(new Error('boom'));
    report(new Error('boom'));
    expect(send).toHaveBeenCalledTimes(1);
    const [url, body] = send.mock.calls[0] ?? [];

    expect(url).toBe('/api/telemetry/errors');
    expect(clientErrorReportSchema.parse(JSON.parse(body ?? '{}'))).toMatchObject({
      kind: 'error',
      message: 'boom',
      release: 'abc',
    });
  });

  it('limit raportow na odslone', () => {
    const send = vi.fn<(url: string, body: string) => void>();
    const report = createClientErrorReporter({ endpoint: '/e', maxReports: 2 }, send);

    for (const n of [1, 2, 3, 4]) report(new Error(`e${n}`));
    expect(send).toHaveBeenCalledTimes(2);
  });
});
