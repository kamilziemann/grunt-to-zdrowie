// Mapowanie sesji Better Auth na `Identity` (@app/contracts) - jedyny ksztalt uzytkownika widoczny poza ta paczka.
import type { Identity } from '@app/contracts';

import type { AuthSession } from './auth';

/** Role w kolumnie sa tekstem JSON (`["admin"]`); toleruje tez gotowa tablice, a smieci zamienia na brak rol. */
export function parseRoles(value: unknown): string[] {
  let raw: unknown = value;

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  return Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string') : [];
}

export function identityFromSession(session: AuthSession | null): Identity | null {
  if (!session) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    roles: parseRoles(session.user.roles),
  };
}
