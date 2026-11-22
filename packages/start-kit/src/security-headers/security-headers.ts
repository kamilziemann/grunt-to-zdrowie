// Naglowki bezpieczenstwa stron HTML (odpowiedzi SSR Workera). Bez `script-src` z nonce: strony publiczne ida ze
// wspolnego cache brzegu, wiec nonce bylby ten sam dla wszystkich uzytkownikow (i jawny w HTML). CSP blokuje za to
// osadzanie w ramkach, podmiane <base>, wtyczki i wysylke formularzy na obce domeny.
/** CSP stron: formularze tylko na wlasny origin. */
export const PAGE_CONTENT_SECURITY_POLICY = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

/** HSTS tylko po HTTPS (lokalnie http://localhost - przegladarka i tak by go zignorowala). */
const HSTS = 'max-age=31536000; includeSubDomains';

/** Dopisuje brakujace naglowki bezpieczenstwa (naglowek ustawiony przez trase ma pierwszenstwo). */
export function withSecurityHeaders(response: Response, url: URL): Response {
  const headers = {
    'content-security-policy': PAGE_CONTENT_SECURITY_POLICY,
    ...HEADERS,
    ...(url.protocol === 'https:' ? { 'strict-transport-security': HSTS } : {}),
  };

  for (const [name, value] of Object.entries(headers)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }

  return response;
}
