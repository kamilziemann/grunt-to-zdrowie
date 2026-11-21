import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

import {
  AUTH_BASE_URL,
  AUTH_WEB_PORT,
  BASE_URL,
  E2E_API_STATE,
  E2E_AUTH_STATE,
  WEB_PORT,
} from './e2e/support/api-state';

// Wartosc testowa (>= 32 znaki), tylko dla lokalnego serwera e2e z auth.
const AUTH_E2E_SECRET = 'e2e-only-secret-e2e-only-secret-0123456789';

/** Zmienne Workera e2e: API pod /api tego samego originu (PUBLIC_URL, CORS) + nadpisania projektu. */
const workerVars = (baseUrl: string, extra: Record<string, string> = {}) =>
  JSON.stringify({ PUBLIC_URL: `${baseUrl}/api`, ALLOWED_ORIGINS: baseUrl, ...extra });

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
  projects: [
    { name: 'chromium', testIgnore: /auth-enabled\.spec\.ts/, use: desktop },
    // Przeplyw z kontami (auth-enabled.spec.ts) na osobnym serwerze z AUTH_ENABLED=true.
    { name: 'auth', testMatch: /auth-enabled\.spec\.ts/, use: { ...desktop, baseURL: AUTH_BASE_URL } },
  ],
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
      env: { APP_STATE_DIR: E2E_API_STATE, APP_VARS: workerVars(BASE_URL) },
    },
    {
      // Serwer z kontami: AUTH_ENABLED + AUTH_SECRET jako zmienne (tylko lokalnie), wlasna D1.
      command:
        `rm -rf ${E2E_AUTH_STATE} && ` +
        `bun x wrangler d1 migrations apply DB --local --persist-to ${E2E_AUTH_STATE} && ` +
        `bun x vite dev --port ${AUTH_WEB_PORT} --strictPort`,
      url: `${AUTH_BASE_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        APP_STATE_DIR: E2E_AUTH_STATE,
        APP_VARS: workerVars(AUTH_BASE_URL, { AUTH_ENABLED: 'true', AUTH_SECRET: AUTH_E2E_SECRET }),
      },
    },
  ],
});
