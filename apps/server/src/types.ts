// Typ aplikacji dla hono/client (apps/web: `import type { AppType } from '@app/server/types'`). Nic wiecej.
import type { createApp } from './entry/app';

export type AppType = ReturnType<typeof createApp>;
