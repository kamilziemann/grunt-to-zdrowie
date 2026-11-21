// @app/rpc - cienka warstwa nad hono/client.
// Dlaczego paczka nie importuje typu serwera: paczki nie moga zalezec od aplikacji. Konsument (apps/web) robi
//   import type { AppType } from '@app/server/types'
//   const api = createRpcClient<AppType>(baseUrl, { fetch })
// i dostaje pelne typowanie end-to-end bez cyklu zaleznosci w runtime.
import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  isProblemDetails,
  problemType,
  type ProblemCode,
  type ProblemDetails,
} from '@app/contracts';
import { hc, type ClientRequestOptions } from 'hono/client';

export type { ClientRequestOptions };

export const createRpcClient = hc;

/** Odpowiedz `fetch` albo klienta Hono (`ClientResponse` z typowanym `json()`) - unwrap potrzebuje tylko tych pol. */
export type ResponseLike = Pick<Response, 'ok' | 'status' | 'statusText' | 'json' | 'text'>;

/** Blad odpowiedzi API: niesie Problem Details, wiec UI moze mapowac `code` na komunikat. */
export class RpcError extends Error {
  readonly problem: ProblemDetails;
  readonly status: number;

  constructor(problem: ProblemDetails, options?: { cause?: unknown }) {
    super(problem.detail ?? problem.title, options);
    this.name = 'RpcError';
    this.problem = problem;
    this.status = problem.status;
  }

  get code(): ProblemCode {
    return this.problem.code;
  }
}

export function isRpcError(value: unknown): value is RpcError {
  return value instanceof RpcError;
}

function fallbackProblem(res: ResponseLike, text: string): ProblemDetails {
  const code: ProblemCode = res.status === 404 ? PROBLEM_CODES.NOT_FOUND : PROBLEM_CODES.INTERNAL;

  return {
    type: problemType(code),
    title: res.statusText || 'Request failed',
    status: res.status,
    detail: text.slice(0, 500) || undefined,
    code,
  };
}

/** Problem Details dla bledu sieci (API nieosiagalne, timeout, przerwane polaczenie) - nie ma odpowiedzi HTTP. */
export function networkProblem(error: unknown): ProblemDetails {
  const code = PROBLEM_CODES.UPSTREAM_FAILED;
  const detail = error instanceof Error ? error.message : String(error);

  return {
    type: problemType(code),
    title: 'API unreachable',
    status: HTTP_STATUS_BY_CODE[code],
    detail: detail.slice(0, 500) || undefined,
    code,
  };
}

/** Dowolny blad -> RpcError: RpcError przechodzi bez zmian, reszta (np. TypeError z fetch) staje sie bledem sieci. */
export function toRpcError(error: unknown): RpcError {
  if (isRpcError(error)) return error;

  return new RpcError(networkProblem(error), { cause: error });
}

/** Zwraca JSON odpowiedzi 2xx albo rzuca RpcError (Problem Details z API lub fallback). */
export async function unwrap<T>(response: ResponseLike | Promise<ResponseLike>): Promise<T> {
  const res = await response;

  if (res.ok) {
    if (res.status === 204) return undefined as T;

    return (await res.json()) as T;
  }

  const text = await res.text();
  let parsed: unknown = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  throw new RpcError(isProblemDetails(parsed) ? parsed : fallbackProblem(res, text));
}

export type Attempt<T> = { ok: true; data: T } | { ok: false; error: RpcError };

/**
 * Bezpieczne dla sieci: zamiast rzucac, zwraca wynik albo RpcError (np. do sekcji strony, ktora ma wlasny stan bledu).
 * Lapie tez bledy sieci (odrzucona obietnica fetch) i zamienia je na RpcError z kodem `upstream_failed`.
 */
export async function attempt<T>(response: ResponseLike | Promise<ResponseLike>): Promise<Attempt<T>> {
  try {
    return { ok: true, data: await unwrap<T>(response) };
  } catch (e) {
    return { ok: false, error: toRpcError(e) };
  }
}

/**
 * Jak `unwrap`, ale 404 z API to `null` (szczegol, ktorego nie ma -> strona rzuca notFound), a blad sieci staje sie
 * RpcError `upstream_failed` (granica bledow pokaze wlasciwy komunikat zamiast TypeError).
 */
export async function unwrapOrNull<T>(response: ResponseLike | Promise<ResponseLike>): Promise<T | null> {
  try {
    return await unwrap<T>(response);
  } catch (error) {
    const rpcError = toRpcError(error);

    if (rpcError.code === PROBLEM_CODES.NOT_FOUND) return null;

    throw rpcError;
  }
}
