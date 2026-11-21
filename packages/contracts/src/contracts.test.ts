import { describe, expect, it } from 'vitest';

import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  listQuerySchema,
  problemDetailsSchema,
  problemType,
  signInInputSchema,
  signUpInputSchema,
} from './index';

describe('problems', () => {
  it('kazdy kod ma status HTTP', () => {
    for (const code of Object.values(PROBLEM_CODES)) expect(HTTP_STATUS_BY_CODE[code]).toBeGreaterThan(0);
  });

  it('Problem Details ma stabilny typ URN', () => {
    const problem = {
      type: problemType('not_found'),
      title: 'Not found',
      status: 404,
      code: 'not_found',
    };

    expect(problemDetailsSchema.parse(problem).type).toBe('urn:app:problem:not_found');
  });
});

describe('listQuerySchema', () => {
  it('domyslny limit i koercja ze stringa', () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
    expect(listQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('formularze auth', () => {
  it('rejestracja wymaga imienia, poprawnego e-maila i hasla 8+ znakow', () => {
    const ok = { name: ' Ala ', email: ' ala@example.com ', password: 'dlugie-haslo' };

    expect(signUpInputSchema.parse(ok)).toEqual({
      name: 'Ala',
      email: 'ala@example.com',
      password: 'dlugie-haslo',
    });
    expect(signUpInputSchema.safeParse({ ...ok, password: 'krotkie' }).success).toBe(false);
    expect(signUpInputSchema.safeParse({ ...ok, email: 'nie-email' }).success).toBe(false);
    expect(signUpInputSchema.safeParse({ ...ok, name: ' ' }).success).toBe(false);
  });

  it('logowanie wymaga e-maila i niepustego hasla', () => {
    expect(signInInputSchema.safeParse({ email: 'a@b.pl', password: 'x' }).success).toBe(true);
    expect(signInInputSchema.safeParse({ email: 'a@b.pl', password: '' }).success).toBe(false);
  });
});
