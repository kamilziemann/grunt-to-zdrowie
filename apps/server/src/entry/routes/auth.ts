// Handler Better Auth pod /auth/* (rejestracja, logowanie, wylogowanie, get-session...). Poza lancuchem modulow
// (to nie nasze OpenAPI), wiec nie wchodzi do AppType. Auth wylaczone = 503 not_configured (Problem Details).
// Better Auth liczy trasy od sciezki adresu publicznego (`PUBLIC_URL` = `https://.../api`), a Worker odcina `/api`
// przed Hono - prefiks wraca tu, zeby linki z maili, callbacki i ciasteczka mialy publiczne adresy.
import type { OpenAPIHono } from '@hono/zod-openapi';
import { AUTH_BASE_PATH } from '@app/auth';

import type { AppEnv } from '../../services/container';
import { authPortFor } from '../middlewares';

/** To samo zapytanie ze sciezka publiczna: `/auth/x` -> `/api/auth/x`, gdy adres publiczny API ma sciezke. */
export function withPublicPath(request: Request, publicUrl: string): Request {
  const prefix = new URL(publicUrl).pathname.replace(/\/+$/, '');

  if (!prefix) return request;

  const url = new URL(request.url);

  url.pathname = `${prefix}${url.pathname}`;

  return new Request(url, request);
}

export function mountAuth(app: OpenAPIHono<AppEnv>): void {
  app.on(['GET', 'POST'], [AUTH_BASE_PATH, `${AUTH_BASE_PATH}/*`], (c) => {
    const vars = c.get('vars');

    return authPortFor(c.env, vars).handle(withPublicPath(c.req.raw, vars.AUTH_URL ?? vars.PUBLIC_URL));
  });
}
