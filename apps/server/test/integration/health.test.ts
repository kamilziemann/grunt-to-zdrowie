import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { makeApp } from '../helpers';

describe('GET /health', () => {
  it('zwraca Health z x-request-id (przez domyslny eksport Workera)', async () => {
    const res = await exports.default.fetch('http://localhost/health', {
      headers: { 'x-request-id': 'req-123' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-123');
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toMatchObject({ ok: true, service: 'grunt-to-zdrowie-server', environment: 'development' });
    expect(typeof body.time).toBe('string');
  });

  it('korelacja: traceId z traceparent wolajacego wraca w x-trace-id', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const res = await makeApp().request('/health', {
      headers: { traceparent: `00-${traceId}-00f067aa0ba902b7-01`, 'x-request-id': 'req-web-1' },
    });

    expect(res.headers.get('x-trace-id')).toBe(traceId);
    expect(res.headers.get('x-request-id')).toBe('req-web-1');
    expect((await makeApp().request('/health')).headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('nieznana trasa = 404 Problem Details', async () => {
    const res = await makeApp().request('/nope');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'not_found', status: 404 });
  });

  it('nieoczekiwany blad = 500; tresc bledu tylko w development (preview jest publiczne)', async () => {
    const boom = (env: Record<string, unknown>) =>
      makeApp({}, env, (app) =>
        app.get('/test-boom', () => {
          throw new Error('Failed query: select * from user where email = ?');
        }),
      ).request('/test-boom');
    const details: (string | null)[] = [];

    for (const ENVIRONMENT of ['development', 'preview', 'production']) {
      const res = await boom({ ENVIRONMENT });

      expect(res.status).toBe(500);
      details.push((await res.json<{ code: string; detail?: string }>()).detail ?? null);
    }

    expect(details).toEqual(['Failed query: select * from user where email = ?', null, null]);
  });

  it('zle srodowisko = 503 not_configured', async () => {
    const res = await makeApp({}, { PUBLIC_URL: 'not-a-url' }).request('/health');

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'not_configured' });
  });

  it('CORS: dozwolony origin dostaje naglowki, obcy nie', async () => {
    const app = makeApp();
    const ok = await app.request('/health', { headers: { origin: 'http://localhost:3000' } });

    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    const preflight = await app.request('/analysis', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'POST' },
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
    const bad = await app.request('/health', { headers: { origin: 'https://evil.example' } });

    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('serwuje /openapi.json (3.1) z nazwanymi DTO i /docs', async () => {
    const app = makeApp();
    const doc = (await (await app.request('/openapi.json')).json()) as {
      openapi: string;
      paths: Record<string, Record<string, { parameters?: { name: string; in: string }[] }>>;
      components: { schemas: Record<string, unknown> };
    };

    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/health', '/parcels/by-id', '/places/search', '/analysis']),
    );
    expect(Object.keys(doc.components.schemas)).toEqual(
      expect.arrayContaining([
        'Parcel',
        'ParcelSearchResult',
        'PlaceSearchResult',
        'AnalysisRequest',
        'WaterReport',
      ]),
    );
    expect(doc.paths['/parcels/by-id']?.get?.parameters).toContainEqual(
      expect.objectContaining({ name: 'id', in: 'query' }),
    );
    const docs = await app.request('/docs');

    expect(docs.status).toBe(200);
    expect(await docs.text()).toContain('/openapi.json');
  });
});
