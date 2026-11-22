import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

import { BASE_URL, E2E_API_STATE, WEB_PORT } from './e2e/support/api-state';

/** Zmienne Workera e2e: API pod /api tego samego originu (PUBLIC_URL, CORS). */
const WORKER_VARS = JSON.stringify({ PUBLIC_URL: `${BASE_URL}/api`, ALLOWED_ORIGINS: BASE_URL });

// Zrzuty wizualne (spec z tagiem @visual) zaleza od systemu (czcionki, antyaliasing), wiec baseline'y leza
// w e2e/__screenshots__/<platforma>/. Bez baseline'ow biezacej platformy albo w CI @visual jest pomijany.
// `E2E_VISUAL=1` wymusza @visual (np. do wygenerowania baseline'ow: `bun run --cwd apps/web test:e2e --
// --update-snapshots`, zob. docs/architecture/testing.md).
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };
const HAS_BASELINES = existsSync(
  fileURLToPath(new URL(`./e2e/__screenshots__/${process.platform}/`, import.meta.url)),
);
const SKIP_VISUAL = process.env.E2E_VISUAL !== '1' && (Boolean(process.env.CI) || !HAS_BASELINES);

// E2E biegnie na prawdziwym serwerze dev (`vite dev`: jedyny Worker - strony TanStack Start + API Hono, lokalna D1).
// Zadnych mockow - testy sprawdzaja caly przeplyw przegladarka -> SSR -> Hono -> D1.

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
  grepInvert: SKIP_VISUAL ? /@visual/ : undefined,
  // `vite dev` kompiluje moduly przy pierwszym wejsciu - zapas na zimny start.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 },
  },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Stale okno (w `desktop` nizej) i jezyk: te same zrzuty i komunikaty niezaleznie od maszyny.
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
  },
  projects: [{ name: 'chromium', use: desktop }],
  webServer: [
    {
      // Swieza lokalna D1 przy kazdym uruchomieniu (migracje), potem jeden serwer (strony + API) na tym stanie.
      command:
        `rm -rf ${E2E_API_STATE} && ` +
        `bun x wrangler d1 migrations apply DB --local --persist-to ${E2E_API_STATE} && ` +
        `bun x vite dev --port ${WEB_PORT} --strictPort`,
      url: `${BASE_URL}/api/health`,
      // Wlasny serwer z wlasnym stanem: istniejacy `bun run dev` wskazuje na inna baze i port.
      reuseExistingServer: false,
      timeout: 240_000,
      env: { APP_STATE_DIR: E2E_API_STATE, APP_VARS: WORKER_VARS },
    },
  ],
});
