import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  problemType,
  type ProblemCode,
  type ProblemDetails,
  type ProblemIssue,
} from '@app/contracts';
import type { ZodError } from 'zod';

export interface AppErrorOptions {
  status?: number;
  issues?: ProblemIssue[];
  /** dodatkowe dane dla logow (nigdy nie trafiaja do odpowiedzi) */
  details?: unknown;
  cause?: unknown;
  /** czy `message` moze trafic do klienta w produkcji (domyslnie tak dla bledow 4xx) */
  expose?: boolean;
  /** powod w ramach kodu (Problem Details `reason`): web pokazuje dla niego wlasny komunikat */
  reason?: string;
}

/** Jedyna klasa bledu domenowego. Kod jest stabilny (kontrakt), status wynika z kodu. */
export class AppError extends Error {
  readonly code: ProblemCode;
  readonly status: number;
  readonly issues: ProblemIssue[] | undefined;
  readonly details: unknown;
  readonly expose: boolean;
  readonly reason: string | undefined;

  constructor(code: ProblemCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? HTTP_STATUS_BY_CODE[code];
    this.issues = options.issues;
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
    this.reason = options.reason;
  }

  static notFound(what: string, id?: string): AppError {
    return new AppError(
      PROBLEM_CODES.NOT_FOUND,
      id === undefined ? `${what} not found` : `${what} '${id}' not found`,
    );
  }

  static validation(
    issues: ProblemIssue[],
    message = 'Request validation failed',
    reason?: string,
  ): AppError {
    return new AppError(PROBLEM_CODES.VALIDATION_FAILED, message, {
      issues,
      ...(reason === undefined ? {} : { reason }),
    });
  }

  static fromZod(error: ZodError, message?: string): AppError {
    return AppError.validation(zodIssues(error), message);
  }

  static upstream(service: string, cause: unknown): AppError {
    return new AppError(PROBLEM_CODES.UPSTREAM_FAILED, `${service} request failed`, { cause, expose: false });
  }

  static notConfigured(what: string): AppError {
    return new AppError(PROBLEM_CODES.NOT_CONFIGURED, `${what} is not configured on this deployment`);
  }

  static internal(message = 'Internal error', cause?: unknown): AppError {
    return new AppError(PROBLEM_CODES.INTERNAL, message, { cause, expose: false });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function zodIssues(error: ZodError): ProblemIssue[] {
  return error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
}

export interface ToProblemContext {
  instance?: string;
  requestId?: string;
  /** poza development false (preview i produkcja sa publiczne): szczegoly bledow 5xx nie wychodza na zewnatrz */
  exposeInternals?: boolean;
}

const TITLES: Record<ProblemCode, string> = {
  validation_failed: 'Validation failed',
  not_found: 'Not found',
  conflict: 'Conflict',
  forbidden: 'Forbidden',
  unauthorized: 'Unauthorized',
  rate_limited: 'Rate limited',
  payload_too_large: 'Payload too large',
  unsupported_media_type: 'Unsupported media type',
  upstream_failed: 'Upstream service failed',
  not_configured: 'Feature not configured',
  internal: 'Internal error',
};

/** Mapuje dowolny blad na Problem Details. Nieznane bledy = 500 bez szczegolow (chyba ze exposeInternals). */
export function toProblem(err: unknown, ctx: ToProblemContext = {}): ProblemDetails {
  const expose = ctx.exposeInternals ?? false;

  if (isAppError(err)) {
    const detail = err.expose || expose ? err.message : undefined;

    return {
      type: problemType(err.code),
      title: TITLES[err.code],
      status: err.status,
      ...(detail === undefined ? {} : { detail }),
      ...(ctx.instance === undefined ? {} : { instance: ctx.instance }),
      code: err.code,
      ...(err.reason === undefined ? {} : { reason: err.reason }),
      ...(err.issues === undefined ? {} : { issues: err.issues }),
      ...(ctx.requestId === undefined ? {} : { requestId: ctx.requestId }),
    };
  }

  const message = err instanceof Error ? err.message : String(err);

  return {
    type: problemType(PROBLEM_CODES.INTERNAL),
    title: TITLES.internal,
    status: 500,
    ...(expose ? { detail: message } : {}),
    ...(ctx.instance === undefined ? {} : { instance: ctx.instance }),
    code: PROBLEM_CODES.INTERNAL,
    ...(ctx.requestId === undefined ? {} : { requestId: ctx.requestId }),
  };
}
