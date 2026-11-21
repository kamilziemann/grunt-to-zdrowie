// Bledy akcji auth (logowanie, rejestracja, wylogowanie) sprowadzone do kilku rodzajow, ktore UI tlumaczy
// (`auth.errors.<rodzaj>`). Zrodlem sa odpowiedzi Better Auth ({ code, status }) albo Problem Details z API/proxy
// (kody `not_configured`, `upstream_failed`), ktore przechodza przez proxy aplikacji bez zmian.
export type AuthErrorKind =
  | 'invalidCredentials'
  | 'userExists'
  | 'invalidInput'
  | 'rateLimited'
  | 'disabled'
  | 'network'
  | 'unknown';

export interface RawAuthError {
  status?: number;
  code?: string;
}

const INPUT_CODES = new Set(['INVALID_EMAIL', 'PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'VALIDATION_ERROR']);

export function classifyAuthError(error: RawAuthError): AuthErrorKind {
  const code = error.code ?? '';

  if (code === 'not_configured' || error.status === 503) return 'disabled';
  if (code === 'upstream_failed' || error.status === 502) return 'network';
  if (code.startsWith('USER_ALREADY_EXISTS')) return 'userExists';
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || error.status === 401) return 'invalidCredentials';
  if (INPUT_CODES.has(code) || error.status === 400 || error.status === 422) return 'invalidInput';
  if (error.status === 429) return 'rateLimited';

  return 'unknown';
}

export class AuthError extends Error {
  readonly kind: AuthErrorKind;

  constructor(kind: AuthErrorKind, options?: { cause?: unknown }) {
    super(`auth failed: ${kind}`, options);
    this.name = 'AuthError';
    this.kind = kind;
  }
}

export function isAuthError(value: unknown): value is AuthError {
  return value instanceof AuthError;
}

/** Dowolny blad akcji -> rodzaj (nieznane wyjatki, np. TypeError z fetch, to `network`). */
export function authErrorKind(error: unknown): AuthErrorKind {
  return isAuthError(error) ? error.kind : 'network';
}
