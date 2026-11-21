// Wejscia serwera (eksport `@app/server/worker`): HTTP (Hono) i Cron Trigger. Wlasnego Workera nie ma - montuje je
// jedyny Worker apps/web (src/worker.ts): fetch pod /api, reszta 1:1. Kontener powstaje per request/przebieg.
// Kolejki, Workflow i Durable Objects dopisujesz tutaj (opis: src/entry/{queues,workflows,durable-objects}/README.md).
// Sentry owija handler, ale jest wylaczony, dopoki SENTRY_ENABLED=true i SENTRY_DSN nie sa ustawione.
import type { RawServerEnv } from '@app/env/server';
import { withSentry } from '@sentry/cloudflare';

import { createContainer } from './container';
import { createApp } from './entry/app';
import { createScheduledHandler } from './entry/cron/scheduled';
import { reportToSentry, sentryOptions } from './infrastructure/sentry';

const app = createApp({ createContainer, reportError: reportToSentry });

export default withSentry((env: RawServerEnv) => sentryOptions(env), {
  fetch: app.fetch,
  scheduled: createScheduledHandler(createContainer),
} satisfies ExportedHandler<RawServerEnv>);
