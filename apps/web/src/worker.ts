// Wejscie JEDYNEGO Workera aplikacji (wrangler.jsonc `main`):
// - /api/*      -> API Hono z apps/server bez zmian (OpenAPI, auth, limity, cache i purge) - prefiks odcinany,
// - reszta      -> TanStack Start (SSR stron), z requestId/sladem i domyslnym `no-store`,
// - scheduled (i queue, klasy Workflow, gdy je dodasz) -> wejscia serwera w tym samym Workerze.
// Przed Workerem stoi Workers Cache: publiczne strony i odczyty API ida z brzegu, Worker liczy tylko MISS-y.
// Nazwa pliku nie moze byc `server.ts` - Start traktuje src/server.ts jako wlasne wejscie (cykl importow).
import type { RawServerEnv } from '@app/env/server';
import { createLogger } from '@app/logger';
import serverWorker from '@app/server/worker';
import { registerServerFetch } from '@app/start-kit/worker';
import startHandler from '@tanstack/react-start/server-entry';
import { env, waitUntil } from 'cloudflare:workers';

import { isApiPath, toApiRequest } from './entry/api-path';
import { handlePageRequest, logLevelOf } from './entry/page-request';

type ServerHandlers = Required<Pick<ExportedHandler<RawServerEnv>, 'fetch' | 'scheduled'>>;

const server = serverWorker as ServerHandlers;

// Wywolanie w procesie: zwykly Request ze strony (bez `cf` brzegu) i kontekst z waitUntil biezacego zapytania.
type InProcessContext = Pick<ExecutionContext, 'waitUntil' | 'passThroughOnException' | 'props'>;

const apiFetch = server.fetch as (
  request: Request,
  env: RawServerEnv,
  ctx: InProcessContext,
) => Response | Promise<Response>;

// Loadery stron wolaja API w procesie (start-kit createIsomorphicApi): ten sam Hono, env i waitUntil biezacego
// zapytania, bez sieci. Rejestracja raz na izolat - jedyne miejsce, ktore laczy strony z kodem serwera.
registerServerFetch(async (request) =>
  apiFetch(toApiRequest(request), env, {
    waitUntil,
    passThroughOnException: () => undefined,
    props: {},
  }),
);

export default {
  fetch(request, workerEnv, ctx) {
    const { pathname } = new URL(request.url);

    if (isApiPath(pathname)) {
      return server.fetch(toApiRequest(request) as typeof request, workerEnv, ctx);
    }

    const logger = createLogger({ level: logLevelOf(workerEnv.LOG_LEVEL) });

    return handlePageRequest(request, (traced) => startHandler.fetch(traced), logger);
  },
  scheduled: (controller, workerEnv, ctx) => server.scheduled(controller, workerEnv, ctx),
} satisfies ExportedHandler<RawServerEnv>;
