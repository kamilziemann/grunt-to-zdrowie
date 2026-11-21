import { PROBLEM_CODES } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError, toProblem } from './app-error';

describe('AppError / toProblem', () => {
  it('mapuje kod na status i typ', () => {
    const p = toProblem(AppError.notFound('Parcel', 'p1'), { instance: '/parcels/p1', requestId: 'r' });

    expect(p).toEqual({
      type: 'urn:app:problem:not_found',
      title: 'Not found',
      status: 404,
      detail: "Parcel 'p1' not found",
      instance: '/parcels/p1',
      code: 'not_found',
      requestId: 'r',
    });
  });

  it('powod w ramach kodu trafia do Problem Details (konflikt i walidacja)', () => {
    const conflict = new AppError(PROBLEM_CODES.CONFLICT, 'blocked', { reason: 'merge_blocked' });
    const invalid = AppError.validation([{ path: 'caseId', message: 'x' }], 'invalid', 'same_case');

    expect(toProblem(conflict)).toMatchObject({ status: 409, code: 'conflict', reason: 'merge_blocked' });
    expect(toProblem(invalid)).toMatchObject({
      status: 400,
      reason: 'same_case',
      issues: [{ path: 'caseId' }],
    });
    expect(toProblem(AppError.notFound('Parcel'))).not.toHaveProperty('reason');
  });

  it('ukrywa szczegoly bledow 5xx w produkcji i pokazuje w dev', () => {
    const err = new Error('db exploded');

    expect(toProblem(err).detail).toBeUndefined();
    expect(toProblem(err, { exposeInternals: true }).detail).toBe('db exploded');
    expect(toProblem(err).code).toBe(PROBLEM_CODES.INTERNAL);
  });

  it('zamienia ZodError na issues', () => {
    const r = z.object({ a: z.number(), b: z.object({ c: z.string() }) }).safeParse({ a: 'x', b: {} });

    expect(r.success).toBe(false);
    if (r.success) return;
    const p = toProblem(AppError.fromZod(r.error));

    expect(p.status).toBe(400);
    expect(p.issues?.map((i) => i.path)).toEqual(['a', 'b.c']);
  });
});
