// Korelacja requestow miedzy Workerami (strony -> API): `x-request-id` (czytelny identyfikator w logach i Problem
// Details) oraz W3C `traceparent` (https://www.w3.org/TR/trace-context/) - ten sam traceId w logach obu Workerow.

export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACEPARENT_HEADER = 'traceparent';

export interface TraceContext {
  /** 32 znaki hex */
  traceId: string;
  /** 16 znakow hex - id biezacego odcinka (span) */
  spanId: string;
  sampled: boolean;
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE = '0'.repeat(32);
const ZERO_SPAN = '0'.repeat(16);

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);

  crypto.getRandomValues(buf);

  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Odczyt naglowka `traceparent`; niepoprawny albo zerowy = null (zaczynamy nowy slad). */
export function parseTraceparent(header: string | null | undefined): TraceContext | null {
  const match = TRACEPARENT.exec(header?.trim().toLowerCase() ?? '');

  if (!match) return null;
  const [, traceId = '', spanId = '', flags = '00'] = match;

  if (traceId === ZERO_TRACE || spanId === ZERO_SPAN) return null;

  return { traceId, spanId, sampled: (Number.parseInt(flags, 16) & 1) === 1 };
}

/** Nowy odcinek: ten sam traceId co rodzic (albo nowy slad), nowy spanId. */
export function childTrace(parent: TraceContext | null): TraceContext {
  return {
    traceId: parent?.traceId ?? randomHex(16),
    spanId: randomHex(8),
    sampled: parent?.sampled ?? true,
  };
}

export function formatTraceparent(trace: TraceContext): string {
  return `00-${trace.traceId}-${trace.spanId}-${trace.sampled ? '01' : '00'}`;
}

/** Naglowki do wywolania innej uslugi: ten sam requestId, odcinek-dziecko sladu. */
export function propagationHeaders(requestId: string, trace: TraceContext): Record<string, string> {
  return { [REQUEST_ID_HEADER]: requestId, [TRACEPARENT_HEADER]: formatTraceparent(childTrace(trace)) };
}
