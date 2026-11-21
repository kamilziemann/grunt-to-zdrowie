import { describe, expect, it } from 'vitest';

import { RpcError, attempt, isRpcError, networkProblem, toRpcError, unwrap, unwrapOrNull } from './index';

const json = (body: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });

describe('unwrap', () => {
  it('zwraca dane dla 2xx', async () => {
    await expect(unwrap<{ a: number }>(json({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it('rzuca RpcError z Problem Details', async () => {
    const problem = {
      type: 'urn:app:problem:not_found',
      title: 'Not found',
      status: 404,
      code: 'not_found',
    };
    const err = await unwrap(json(problem, 404, 'application/problem+json')).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(RpcError);
    expect(isRpcError(err) ? err.code : null).toBe('not_found');
  });

  it('fallback dla nie-JSON', async () => {
    const r = await attempt(new Response('gateway down', { status: 502 }));

    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.error.problem.detail).toBe('gateway down');
  });
});

describe('attempt', () => {
  it('zamienia blad sieci na RpcError upstream_failed', async () => {
    const r = await attempt(Promise.reject(new TypeError('fetch failed')));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('upstream_failed');
    expect(r.error.status).toBe(502);
    expect(r.error.problem.detail).toBe('fetch failed');
    expect(r.error.cause).toBeInstanceOf(TypeError);
  });
});

describe('toRpcError', () => {
  it('przepuszcza RpcError bez zmian', () => {
    const original = new RpcError(networkProblem(new Error('x')));

    expect(toRpcError(original)).toBe(original);
  });

  it('opakowuje wartosci nie bedace Error', () => {
    const err = toRpcError('boom');

    expect(err.code).toBe('upstream_failed');
    expect(err.problem.detail).toBe('boom');
  });
});

describe('unwrapOrNull', () => {
  it('404 -> null, 2xx -> dane', async () => {
    const notFound = {
      type: 'urn:app:problem:not_found',
      title: 'Not found',
      status: 404,
      code: 'not_found',
    };

    await expect(unwrapOrNull(json(notFound, 404, 'application/problem+json'))).resolves.toBeNull();
    await expect(unwrapOrNull<{ a: number }>(json({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it('blad sieci -> RpcError upstream_failed', async () => {
    const err = await unwrapOrNull(Promise.reject(new TypeError('fetch failed'))).catch((e: unknown) => e);

    expect(isRpcError(err) ? err.code : null).toBe('upstream_failed');
  });
});
