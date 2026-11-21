// Typ `env` z cloudflare:workers / cloudflare:test w testach: bindingi z wrangler.jsonc + bindingi testowe z vitest.config.ts.
import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ASSETS?: Fetcher;
      TEST_MIGRATIONS: D1Migration[];
      PUBLIC_URL: string;
      ALLOWED_ORIGINS: string;
      ENVIRONMENT: string;
      LOG_LEVEL: string;
    }

    // `exports` z cloudflare:workers w testach = eksporty wejscia testowego Workera (vitest.config.ts `main`)
    interface GlobalProps {
      mainModule: typeof import('../src/index');
    }
  }
}

export {};
