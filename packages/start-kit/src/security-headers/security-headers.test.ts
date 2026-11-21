import { describe, expect, it } from 'vitest';

import {
  PAGE_CONTENT_SECURITY_POLICY,
  pageContentSecurityPolicy,
  withSecurityHeaders,
} from './security-headers';

describe('withSecurityHeaders', () => {
  it('dopisuje naglowki bezpieczenstwa, HSTS tylko po HTTPS', () => {
    const https = withSecurityHeaders(new Response('ok'), new URL('https://example.com/'));
    const http = withSecurityHeaders(new Response('ok'), new URL('http://localhost:3000/'));

    expect(https.headers.get('content-security-policy')).toBe(PAGE_CONTENT_SECURITY_POLICY);
    expect(https.headers.get('x-frame-options')).toBe('DENY');
    expect(https.headers.get('x-content-type-options')).toBe('nosniff');
    expect(https.headers.get('strict-transport-security')).toContain('max-age=');
    expect(http.headers.has('strict-transport-security')).toBe(false);
  });

  it('nie nadpisuje naglowka ustawionego przez trase', () => {
    const response = new Response('ok', { headers: { 'x-frame-options': 'SAMEORIGIN' } });

    expect(
      withSecurityHeaders(response, new URL('https://example.com/')).headers.get('x-frame-options'),
    ).toBe('SAMEORIGIN');
  });

  it('CSP bez nonce (strony z cache brzegu), z frame-ancestors i form-action', () => {
    expect(PAGE_CONTENT_SECURITY_POLICY).not.toContain('nonce');
    expect(PAGE_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(PAGE_CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
  });

  it('form-action z originem dostawcy logowania (przekierowanie formularza wylogowania)', () => {
    const res = withSecurityHeaders(new Response('ok'), new URL('https://app.example.com/'), {
      formActions: ['https://auth.example.com'],
    });

    expect(res.headers.get('content-security-policy')).toContain(
      "form-action 'self' https://auth.example.com",
    );
    expect(pageContentSecurityPolicy()).toBe(PAGE_CONTENT_SECURITY_POLICY);
  });
});
