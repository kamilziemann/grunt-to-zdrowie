// Stabilne kody bledow (RFC 9457 Problem Details). Backend mapuje AppError -> ProblemDetails,
// frontend mapuje `code` na komunikat dla uzytkownika. Komunikaty `detail` sa dla deweloperow (po angielsku).
import { z } from 'zod';

export const PROBLEM_CODES = {
  VALIDATION_FAILED: 'validation_failed',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  FORBIDDEN: 'forbidden',
  UNAUTHORIZED: 'unauthorized',
  RATE_LIMITED: 'rate_limited',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  UNSUPPORTED_MEDIA_TYPE: 'unsupported_media_type',
  UPSTREAM_FAILED: 'upstream_failed',
  NOT_CONFIGURED: 'not_configured',
  INTERNAL: 'internal',
} as const;

export type ProblemCode = (typeof PROBLEM_CODES)[keyof typeof PROBLEM_CODES];
export const problemCodeSchema = z.enum(PROBLEM_CODES);

export const HTTP_STATUS_BY_CODE: Record<ProblemCode, number> = {
  validation_failed: 400,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  unauthorized: 401,
  rate_limited: 429,
  payload_too_large: 413,
  unsupported_media_type: 415,
  upstream_failed: 502,
  not_configured: 503,
  internal: 500,
};

export const problemIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ProblemIssue = z.infer<typeof problemIssueSchema>;

export const problemDetailsSchema = z.object({
  /** URI typu problemu, np. urn:app:problem:validation_failed */
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: problemCodeSchema,
  /**
   * Powod w ramach kodu (np. konkretna przyczyna 409): web pokazuje dla znanego powodu wlasny komunikat z
   * podpowiedzia, a bez niego - komunikat dla `code`. Slownik powodow zyje przy kontrakcie obszaru.
   */
  reason: z.string().min(1).max(64).optional(),
  issues: z.array(problemIssueSchema).optional(),
  requestId: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const PROBLEM_TYPE_PREFIX = 'urn:app:problem:';
export const problemType = (code: ProblemCode): string => PROBLEM_TYPE_PREFIX + code;

export function isProblemDetails(value: unknown): value is ProblemDetails {
  return problemDetailsSchema.safeParse(value).success;
}
