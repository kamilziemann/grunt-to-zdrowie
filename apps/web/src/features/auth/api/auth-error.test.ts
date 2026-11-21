import { describe, expect, it } from 'vitest';

import { authErrorKind, AuthError, classifyAuthError } from './auth-error';

describe('classifyAuthError', () => {
  it.each([
    [{ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' }, 'invalidCredentials'],
    [{ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }, 'userExists'],
    [{ status: 400, code: 'PASSWORD_TOO_SHORT' }, 'invalidInput'],
    [{ status: 429 }, 'rateLimited'],
    [{ status: 503, code: 'not_configured' }, 'disabled'],
    [{ status: 502, code: 'upstream_failed' }, 'network'],
    [{ status: 500 }, 'unknown'],
  ] as const)('%j -> %s', (error, kind) => {
    expect(classifyAuthError(error)).toBe(kind);
  });

  it('wyjatki spoza AuthError to blad sieci', () => {
    expect(authErrorKind(new TypeError('fetch failed'))).toBe('network');
    expect(authErrorKind(new AuthError('userExists'))).toBe('userExists');
  });
});
