// Drobne pomocniki do definicji tras OpenAPI (createRoute): odpowiedzi JSON i Problem Details.
import { problemDetailsSchema } from '@app/contracts';
import type { ZodType } from 'zod';

export const PROBLEM_JSON = 'application/problem+json' as const;

export function jsonResponse<T extends ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } } as const;
}

export function problemResponse(description: string) {
  return { description, content: { [PROBLEM_JSON]: { schema: problemDetailsSchema } } } as const;
}

export function jsonBody<T extends ZodType>(schema: T, required = true) {
  return { required, content: { 'application/json': { schema } } } as const;
}

export const notFound = problemResponse('Not found (Problem Details)');
export const validationFailed = problemResponse('Request validation failed (Problem Details with issues)');
