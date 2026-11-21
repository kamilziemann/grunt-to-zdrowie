import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from './app-error';
import { createErrorHandler, notFoundHandler } from './hono';

describe('hono adapter', () => {
  const app = new Hono();
  const onServerError = vi.fn<(err: unknown) => void>();

  app.onError(createErrorHandler({ exposeInternals: false, onServerError }));
  app.notFound(notFoundHandler);
  app.get('/boom', () => {
    throw new AppError('conflict', 'report already exists');
  });
  app.get('/crash', () => {
    throw new Error('secret internals');
  });

  it('zwraca problem+json z kodem', async () => {
    const res = await app.request('/boom');

    expect(res.status).toBe(409);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    const body = (await res.json()) as { code: string; detail: string };

    expect(body.code).toBe('conflict');
    expect(body.detail).toBe('report already exists');
  });

  it('nie ujawnia internals dla 500', async () => {
    const body = (await (await app.request('/crash')).json()) as { status: number; detail?: string };

    expect(body.status).toBe(500);
    expect(body.detail).toBeUndefined();
  });

  it('raportuje tylko bledy 5xx (onServerError)', async () => {
    onServerError.mockClear();
    await app.request('/boom');
    expect(onServerError).not.toHaveBeenCalled();
    await app.request('/crash');
    expect(onServerError).toHaveBeenCalledTimes(1);
  });

  it('404 jako problem', async () => {
    const res = await app.request('/nope');

    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe('not_found');
  });
});
