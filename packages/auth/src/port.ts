// Waski interfejs, z ktorego korzysta aplikacja (entry): obsluga /auth/* i odczyt tozsamosci z naglowkow.
// Dzieki niemu Worker nie dotyka typow Better Auth, a testy moga podstawic faka.
import type { Identity } from '@app/contracts';
import type { Db } from '@app/db';

import { createAuth, type AuthConfig } from './auth';
import { identityFromSession } from './identity';

export interface AuthPort {
  /** Obsluguje zapytanie HTTP pod `/auth/*` (rejestracja, logowanie, wylogowanie, get-session...). */
  handle(request: Request): Promise<Response>;
  /** Tozsamosc z ciasteczka sesji (naglowki zapytania) albo null, gdy brak/wygasla sesja. */
  resolveIdentity(headers: Headers): Promise<Identity | null>;
}

export function createAuthPort(db: Db, config: AuthConfig): AuthPort {
  const auth = createAuth(db, config);

  return {
    handle: (request) => auth.handler(request),
    async resolveIdentity(headers) {
      return identityFromSession(await auth.api.getSession({ headers }));
    },
  };
}
