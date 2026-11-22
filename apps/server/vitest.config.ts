// Testy jednostkowe (src/**/*.test.ts, z fakami) i integracyjne (test/integration/**) biegna w jednym projekcie
// w workerd (@cloudflare/vitest-plugin): bindingi z wrangler.jsonc jedynego Workera (apps/web), ale `main` to wejscie
// serwera (src/index.ts: fetch Hono, cron, kolejka i klasy Workflow) - bez warstwy stron. D1 w pamieci, migracje z
// packages/db.
import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.resolve(import.meta.dirname, '../../packages/db/migrations'),
  );

  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        wrangler: { configPath: '../web/wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            PUBLIC_URL: 'http://localhost:3000/api',
            ALLOWED_ORIGINS: 'http://localhost:3000',
            ENVIRONMENT: 'development',
            LOG_LEVEL: 'silent',
          },
        },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
