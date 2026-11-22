// Zapytanie o strone (SSR): nadaje mu requestId i slad (kontynuacja `traceparent`, jesli przyszedl), zeby wywolania
// API w procesie (start-kit forwardRequestHeaders) i linia logu `page` mialy ten sam traceId. Odpowiedz bez polityki
// cache dostaje `private, no-store` (Workers Cache inaczej trzymalby ja 2 h), `x-request-id` do zgloszen bledow
// i naglowki bezpieczenstwa (CSP bez nonce, ramki, HSTS po HTTPS).
import {
  childTrace,
  formatTraceparent,
  isLogLevel,
  parseTraceparent,
  REQUEST_ID_HEADER,
  TRACEPARENT_HEADER,
  type Logger,
} from '@app/logger';
import { withDefaultCacheControl, withSecurityHeaders } from '@app/start-kit/worker';

export interface PageRenderer {
  (request: Request): Response | Promise<Response>;
}

export function logLevelOf(value: unknown): 'debug' | 'info' | 'warn' | 'error' | 'silent' {
  return isLogLevel(value) ? value : 'info';
}

export async function handlePageRequest(
  request: Request,
  render: PageRenderer,
  logger: Logger,
): Promise<Response> {
  const started = Date.now();
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  const trace = childTrace(parseTraceparent(request.headers.get(TRACEPARENT_HEADER)));
  const traced = new Request(request);

  traced.headers.set(REQUEST_ID_HEADER, requestId);
  traced.headers.set(TRACEPARENT_HEADER, formatTraceparent(trace));

  const log = logger.child({ requestId, traceId: trace.traceId, spanId: trace.spanId });
  const url = new URL(request.url);

  try {
    const response = withSecurityHeaders(withDefaultCacheControl(await render(traced)), url);

    response.headers.set(REQUEST_ID_HEADER, requestId);
    log.info('page', {
      method: request.method,
      path: url.pathname,
      status: response.status,
      ms: Date.now() - started,
    });

    return response;
  } catch (error) {
    log.error('page failed', { method: request.method, path: url.pathname, err: error });

    throw error;
  }
}
