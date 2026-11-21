import { describe, expect, it } from 'vitest';

import type { AuthSession } from './auth';
import { identityFromSession, parseRoles } from './identity';

describe('parseRoles', () => {
  it('czyta tekst JSON, tablice i odrzuca smieci', () => {
    expect(parseRoles('["admin","editor"]')).toEqual(['admin', 'editor']);
    expect(parseRoles(['a', 1, 'b'])).toEqual(['a', 'b']);
    expect(parseRoles('nie-json')).toEqual([]);
    expect(parseRoles('{"a":1}')).toEqual([]);
    expect(parseRoles(undefined)).toEqual([]);
  });
});

describe('identityFromSession', () => {
  it('null przy braku sesji', () => {
    expect(identityFromSession(null)).toBeNull();
  });

  it('mapuje uzytkownika na Identity z domyslnie pustymi rolami', () => {
    const session = { user: { id: 'u1', email: 'a@b.pl', roles: '[]' } } as unknown as AuthSession;

    expect(identityFromSession(session)).toEqual({ userId: 'u1', email: 'a@b.pl', roles: [] });
  });
});
