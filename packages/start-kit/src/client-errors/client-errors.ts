// Raporty bledow przegladarki do API (`POST <endpoint>`, kontrakt `clientErrorReportSchema`). Workers Logs nie widza
// przegladarki, wiec bez tego bledy JS po hydracji sa niewidoczne. Raport niesie traceId odslony (te same co
// zapytania API), sciezke bez query i wersje. Limit na odslone i deduplikacja chronia przed zalaniem logow.
import type { ClientErrorReport } from '@app/contracts';

import { getPageTrace, pageTraceHeaders } from '../page-trace';

export interface ClientErrorReporterOptions {
  endpoint: string;
  release?: string;
  /** maks. raportow na odslone (petla bledow nie zaleje logow) */
  maxReports?: number;
}

type Send = (url: string, body: string) => void;

// `traceparent` odslony: linia logu API z raportem ma ten sam traceId, co zapytania tej strony.
const defaultSend: Send = (url, body) => {
  void fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'content-type': 'application/json', ...pageTraceHeaders() },
  }).catch(() => undefined);
};

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };

  return { message: typeof error === 'string' ? error : (JSON.stringify(error) ?? 'unknown error') };
}

export function createClientErrorReporter(options: ClientErrorReporterOptions, send: Send = defaultSend) {
  const seen = new Set<string>();
  const max = options.maxReports ?? 10;

  return (error: unknown, kind: ClientErrorReport['kind'] = 'error'): void => {
    const { message, stack } = describe(error);
    const key = `${kind}:${message}`;

    if (seen.has(key) || seen.size >= max) return;
    seen.add(key);

    const report: ClientErrorReport = {
      kind,
      message: message.slice(0, 1000),
      ...(stack ? { stack: stack.slice(0, 8000) } : {}),
      path: window.location.pathname.slice(0, 500),
      traceId: getPageTrace().traceId,
      ...(options.release ? { release: options.release } : {}),
    };

    send(options.endpoint, JSON.stringify(report));
  };
}

/** Podpina globalne `error` i `unhandledrejection`; zwraca funkcje do recznych raportow (granice bledow tras). */
export function installClientErrorReporter(options: ClientErrorReporterOptions) {
  const report = createClientErrorReporter(options);

  window.addEventListener('error', (event) => report(event.error ?? event.message, 'error'));
  window.addEventListener('unhandledrejection', (event) => report(event.reason, 'unhandledrejection'));

  return report;
}
