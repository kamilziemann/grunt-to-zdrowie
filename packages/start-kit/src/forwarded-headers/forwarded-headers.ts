// Naglowki biezacego zapytania, ktore przenosimy do wywolania API w procesie (SSR). Od nich zalezy wynik i
// diagnostyka: ciasteczko (sesja), IP (limity i audyt - bez niego wszystkie rendery wpadlyby do jednego licznika),
// jezyk i korelacja logow. Slad dostaje nowy odcinek-dziecko, wiec SSR i API sa w logach jednym `traceId`.
import {
  childTrace,
  formatTraceparent,
  parseTraceparent,
  REQUEST_ID_HEADER,
  TRACEPARENT_HEADER,
} from '@app/logger';

export const FORWARDED_REQUEST_HEADERS = [
  'cookie',
  'cf-connecting-ip',
  'accept-language',
  'user-agent',
] as const;

/** Kopiuje naglowki z `incoming` do `target` (bez nadpisywania ustawionych) i dokleja slad-dziecko. */
export function forwardRequestHeaders(target: Headers, incoming: Headers): Headers {
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);

    if (value && !target.has(name)) target.set(name, value);
  }

  const requestId = incoming.get(REQUEST_ID_HEADER);

  if (requestId && !target.has(REQUEST_ID_HEADER)) target.set(REQUEST_ID_HEADER, requestId);

  if (!target.has(TRACEPARENT_HEADER)) {
    target.set(
      TRACEPARENT_HEADER,
      formatTraceparent(childTrace(parseTraceparent(incoming.get(TRACEPARENT_HEADER)))),
    );
  }

  return target;
}
