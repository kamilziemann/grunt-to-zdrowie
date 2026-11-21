import { RpcError } from '@app/rpc';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseApiResponse } from './parse';

const schema = z.object({ id: z.string(), count: z.number() });

describe('parseApiResponse', () => {
  it('zwraca dane zgodne ze schematem', () => {
    expect(parseApiResponse(schema, { id: 'a', count: 2 })).toEqual({ id: 'a', count: 2 });
  });

  it('niezgodny kształt zamienia na RpcError upstream_failed ze ścieżkami pól', () => {
    let error: unknown;

    try {
      parseApiResponse(schema, { id: 1 }, 'katalog');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(RpcError);

    const problem = (error as RpcError).problem;

    expect([problem.code, problem.status, problem.title]).toEqual([
      'upstream_failed',
      502,
      'Unexpected shape of katalog',
    ]);
    expect(problem.detail).toMatch(/^id: .*; count: /);
  });
});
