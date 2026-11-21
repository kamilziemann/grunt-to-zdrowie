// Autoryzacja jako czyste funkcje: polityka to `(identity, resource?) => boolean`, przekazywana jawnie tam, gdzie jest
// potrzebna. Role biznesowe nie sa narzucone (`roles` to zwykle napisy): wlasne polityki sklada sie z tych
// klockow. Uwierzytelnianie (kim jestes) to osobny temat: middleware w entry; tutaj tylko "czy wolno".
import { STAFF_ROLES, type Identity } from '@app/contracts';

/** Polityka dostepu. `identity === null` = niezalogowany (albo auth wylaczone). `resource` to np. zapisane pole z `ownerId`. */
export type Policy<Resource = unknown> = (identity: Identity | null, resource?: Resource) => boolean;

/** Kazdy zalogowany. */
export const isAuthenticated: Policy = (identity) => identity !== null;

/** Zalogowany z co najmniej jedna z podanych rol. */
export const hasAnyRole =
  (...roles: string[]): Policy =>
  (identity) =>
    identity !== null && roles.some((role) => identity.roles.includes(role));

/** Zalogowany ze wszystkimi podanymi rolami. */
export const hasAllRoles =
  (...roles: string[]): Policy =>
  (identity) =>
    identity !== null && roles.every((role) => identity.roles.includes(role));

/** Wlasciciel zasobu: `getOwnerId` wyciaga id wlasciciela z zasobu (brak zasobu = brak dostepu). */
export const isOwner =
  <Resource>(getOwnerId: (resource: Resource) => string | null | undefined): Policy<Resource> =>
  (identity, resource) =>
    identity !== null && resource !== undefined && getOwnerId(resource) === identity.userId;

/** Dostep, gdy ktorakolwiek polityka pozwala (pusta lista = brak dostepu). */
export const anyOf =
  <Resource>(...policies: Policy<Resource>[]): Policy<Resource> =>
  (identity, resource) =>
    policies.some((policy) => policy(identity, resource));

/** Dostep, gdy wszystkie polityki pozwalaja (pusta lista = dostep). */
export const allOf =
  <Resource>(...policies: Policy<Resource>[]): Policy<Resource> =>
  (identity, resource) =>
    policies.every((policy) => policy(identity, resource));

export type Decision = 'allow' | 'unauthenticated' | 'forbidden';

/** Wynik oceny polityki: odroznia brak logowania (401) od braku uprawnien (403). */
export function decide<Resource>(
  policy: Policy<Resource>,
  identity: Identity | null,
  resource?: Resource,
): Decision {
  if (policy(identity, resource)) return 'allow';

  return identity === null ? 'unauthenticated' : 'forbidden';
}

// --- Role zespolu ----------------------------------------------------------------------------------------------

/**
 * Role nadawane przez backend (`user.roles`, `bun run admin:grant`). Polityki skladaja je z
 * klockow powyzej, np. `export const canManageX: Policy = hasAnyRole(ROLES.admin);`.
 */
export const ROLES = STAFF_ROLES;
