// @vitest-environment node
import { createLogger, parseTraceparent } from '@app/logger';
import { describe, expect, it } from 'vitest';

import { handlePageRequest } from './page-request';

describe('handlePageRequest', () => {
  it('nadaje slad zapytaniu, loguje strone i dokleja no-store, gdy trasa nie ustawila cache', async () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'info', sink: (line) => lines.push(line) });
    let seen: Request | undefined;

    const response = await handlePageRequest(
      new Request('https://example.com/articles/a'),
      (request) => {
        seen = request;

        return new Response('<html>', { status: 200 });
      },
      logger,
    );

    const trace = parseTraceparent(seen?.headers.get('traceparent'));
    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;

    expect(trace).not.toBeNull();
    expect(entry).toMatchObject({ msg: 'page', path: '/articles/a', status: 200, traceId: trace?.traceId });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-request-id')).toBe(seen?.headers.get('x-request-id'));
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('zostawia polityke cache ustawiona przez trase', async () => {
    const response = await handlePageRequest(
      new Request('https://example.com/'),
      () => new Response('x', { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } }),
      createLogger({ level: 'silent' }),
    );

    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
  });
});
