// Slad odslony strony w przegladarce: jeden traceId na zaladowanie strony (HTML z cache'u CDN jest wspolny, wiec
// slad nie moze pochodzic z serwera). Kazde zapytanie API dostaje odcinek-dziecko, a raport bledu ten sam traceId -
// w logach Cloudflare widac cala sciezke: blad w przegladarce -> jego zapytania -> logi Hono i D1.
import { childTrace, propagationHeaders, type TraceContext } from '@app/logger';

let pageTrace: TraceContext | undefined;

export function getPageTrace(): TraceContext {
  pageTrace ??= childTrace(null);

  return pageTrace;
}

/** Naglowki korelacji dla zapytania z przegladarki: nowy requestId, odcinek-dziecko sladu odslony. */
export function pageTraceHeaders(): Record<string, string> {
  return propagationHeaders(crypto.randomUUID(), getPageTrace());
}
