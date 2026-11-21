// Handler czyta tylko to, co middleware wlozyl do kontekstu (identity, vars): zero Better Auth, zero I/O.
import type { RouteHandler } from '@hono/zod-openapi';

import type { AppEnv } from '../../services/container';
import type { getMe } from './me.routes';

export const me: RouteHandler<typeof getMe, AppEnv> = (c) => {
  const identity = c.get('identity');

  return c.json(
    {
      authEnabled: c.get('vars').AUTH_ENABLED,
      authenticated: identity !== null,
      user: identity === null ? null : { id: identity.userId, email: identity.email, roles: identity.roles },
    },
    200,
  );
};
