// Egzekwowanie polityk w serwisach i middleware: tlumaczy decyzje z domain/authorization na AppError.
// Serwis dostaje `identity` jako jawny parametr (nigdy z Hono/Better Auth) i sam decyduje, czy wola `authorize`.
import type { Identity } from '@app/contracts';
import { AppError } from '@app/http';

import { decide, type Policy } from '../../domain/authorization';

/** Przepuszcza, gdy polityka pozwala; inaczej 401 `unauthorized` (brak tozsamosci) albo 403 `forbidden`. */
export function authorize<Resource>(
  policy: Policy<Resource>,
  identity: Identity | null,
  resource?: Resource,
): void {
  const decision = decide(policy, identity, resource);

  if (decision === 'unauthenticated') {
    throw new AppError('unauthorized', 'Authentication required', { expose: true });
  }

  if (decision === 'forbidden') {
    throw new AppError('forbidden', 'You are not allowed to perform this action', { expose: true });
  }
}
