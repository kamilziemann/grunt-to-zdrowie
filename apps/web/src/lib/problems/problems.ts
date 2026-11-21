// Mapowanie kodow Problem Details (RFC 9457) na komunikaty dla uzytkownika (messages/*.json, przestrzen `problems`).
// `detail` z API jest po angielsku i dla deweloperow - UI pokazuje komunikat w jezyku uzytkownika, a detail tylko
// jako dopisek techniczny.
import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  problemType,
  type ProblemCode,
  type ProblemDetails,
} from '@app/contracts';
import { isRpcError, toRpcError } from '@app/rpc';

/** Klucz komunikatu w przestrzeni `problems` (messages/*.json): kod problemu albo `unknown` (komunikat ogolny). */
export type ProblemMessageKey = ProblemCode | 'unknown';

/** Funkcja tlumaczaca z przestrzeni `problems` (`useTranslations('problems')`). */
export type ProblemTranslator = (key: ProblemMessageKey) => string;

const KNOWN_CODES = new Set<string>(Object.values(PROBLEM_CODES));

/** Kod problemu -> klucz komunikatu (nieznany kod albo brak -> `unknown`). Kompletnosc wymusza typ tlumacza: brak klucza w pl.json = blad typow. */
export function problemMessageKey(code: string | undefined): ProblemMessageKey {
  return code && KNOWN_CODES.has(code) ? (code as ProblemCode) : 'unknown';
}

/** Komunikat dla uzytkownika wg kodu problemu, w jezyku tlumacza. */
export function problemMessage(t: ProblemTranslator, code: string | undefined): string {
  return t(problemMessageKey(code));
}

/** Dowolny blad (RpcError, TypeError z fetch, string...) -> Problem Details, zeby UI mial jedna sciezke bledu. */
export function toProblem(error: unknown): ProblemDetails {
  return toRpcError(error).problem;
}

/**
 * Blad przechwycony przez granice bledow trasy (`errorComponent`): RpcError zachowuje swoj problem (np. API
 * nieosiagalne = `upstream_failed`), reszta to `internal` z poczatkiem komunikatu jako detail techniczny.
 */
export function renderErrorProblem(error: unknown): ProblemDetails {
  if (isRpcError(error)) return error.problem;
  const code = PROBLEM_CODES.INTERNAL;
  const message = error instanceof Error ? error.message : String(error);

  return {
    type: problemType(code),
    title: 'Page rendering failed',
    status: HTTP_STATUS_BY_CODE[code],
    detail: message.slice(0, 300) || undefined,
    code,
  };
}

/** Krotki opis problemu do toastow: komunikat wg kodu + ewentualny detail techniczny. */
export function describeProblem(t: ProblemTranslator, problem: ProblemDetails): string {
  const message = problemMessage(t, problem.code);

  return problem.detail ? `${message} (${problem.detail})` : message;
}
