import { PROBLEM_CODES, problemType, type ProblemDetails } from '@app/contracts';
import { RpcError } from '@app/rpc';
import { describe, expect, it } from 'vitest';

import { translator } from '@/test/render-intl';

import { problemMessageKey, renderErrorProblem, toProblem } from './problems';

describe('problemMessageKey', () => {
  it('każdy kod z contracts ma niepusty komunikat w obu językach', () => {
    for (const locale of ['pl', 'en'] as const) {
      const t = translator('problems', locale);

      for (const code of Object.values(PROBLEM_CODES)) {
        expect(t(problemMessageKey(code)).length).toBeGreaterThan(10);
      }
    }
  });

  it('nieznany kod i brak kodu dają komunikat ogólny', () => {
    expect(problemMessageKey('totally_unknown')).toBe('unknown');
    expect(problemMessageKey(undefined)).toBe('unknown');
  });
});

describe('toProblem', () => {
  it('RpcError zachowuje swój problem', () => {
    const problem: ProblemDetails = {
      type: problemType(PROBLEM_CODES.NOT_FOUND),
      title: 'Not found',
      status: 404,
      code: PROBLEM_CODES.NOT_FOUND,
    };

    expect(toProblem(new RpcError(problem))).toEqual(problem);
  });

  it('błąd sieci (TypeError z fetch) staje się upstream_failed', () => {
    const problem = toProblem(new TypeError('fetch failed'));

    expect(problem.code).toBe(PROBLEM_CODES.UPSTREAM_FAILED);
    expect(problem.status).toBe(502);
    expect(problem.detail).toBe('fetch failed');
  });
});

describe('renderErrorProblem', () => {
  it('blad nie z API to internal z komunikatem jako detail', () => {
    const problem = renderErrorProblem(new Error('boom'));

    expect(problem.code).toBe(PROBLEM_CODES.INTERNAL);
    expect(problem.detail).toBe('boom');
  });

  it('wartosc nie bedaca Error tez daje problem', () => {
    expect(renderErrorProblem('kaput').detail).toBe('kaput');
  });

  it('RpcError z loadera zachowuje kod z API', () => {
    const problem: ProblemDetails = {
      type: problemType(PROBLEM_CODES.CONFLICT),
      title: 'Conflict',
      status: 409,
      code: PROBLEM_CODES.CONFLICT,
    };

    expect(renderErrorProblem(new RpcError(problem)).code).toBe(PROBLEM_CODES.CONFLICT);
  });
});
