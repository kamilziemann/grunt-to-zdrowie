// Reguly architektury egzekwowane przez `bun run architecture:check` (tools/architecture-check).
// Zmieniasz zaleznosc miedzy paczkami/warstwami? Zmien tutaj - i tylko tutaj.
import { defineArchitecture } from './tools/architecture-check/src/config';

const S = '@app';

export default defineArchitecture({
  scope: S,
  include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}', 'tools/*/src/**/*.{ts,tsx}'],
  exclude: [
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    '**/test/**',
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
  ],

  // Graf zaleznosci miedzy paczkami - musi byc acykliczny (checker to sprawdza).
  packages: {
    [`${S}/config`]: { dir: 'packages/config', allowed: [] },
    [`${S}/logger`]: { dir: 'packages/logger', allowed: [] },
    [`${S}/contracts`]: { dir: 'packages/contracts', allowed: [] },
    [`${S}/http`]: { dir: 'packages/http', allowed: [`${S}/contracts`, `${S}/logger`] },
    [`${S}/env`]: { dir: 'packages/env', allowed: [] },
    [`${S}/db`]: { dir: 'packages/db', allowed: [`${S}/contracts`] },
    [`${S}/auth`]: { dir: 'packages/auth', allowed: [`${S}/contracts`, `${S}/db`] },
    [`${S}/rpc`]: { dir: 'packages/rpc', allowed: [`${S}/contracts`] },
    // Cache brzegowy (Workers Cache): tagi, polityki i naglowki wspolne dla stron i API - czyste funkcje.
    [`${S}/cache`]: { dir: 'packages/cache', allowed: [] },
    // Narzedzia aplikacji TanStack Start w jednym Workerze (klient API, cache tras, SEO, telemetria przegladarki).
    [`${S}/start-kit`]: {
      dir: 'packages/start-kit',
      allowed: [`${S}/cache`, `${S}/contracts`, `${S}/logger`, `${S}/rpc`],
    },
  },

  apps: {
    [`${S}/server`]: {
      dir: 'apps/server',
      layers: {
        layers: {
          entry: 'src/entry/**',
          modules: 'src/modules/**',
          services: 'src/services/**',
          repositories: 'src/repositories/**',
          domain: 'src/domain/**',
          infrastructure: 'src/infrastructure/**',
          lib: 'src/lib/**',
          root: 'src/*.ts',
        },
        allowed: {
          root: ['entry', 'modules', 'services', 'repositories', 'infrastructure', 'domain', 'lib'],
          entry: ['modules', 'services', 'repositories', 'infrastructure', 'domain', 'lib'],
          modules: ['services', 'domain', 'lib'],
          services: ['repositories', 'domain', 'lib'],
          repositories: ['domain', 'lib'],
          infrastructure: ['domain', 'lib'],
          domain: [],
          lib: [],
        },
        forbiddenModules: {
          // Services znaja tylko porty (interfejsy) - zadnego Hono ani Drizzle.
          services: ['hono', '@hono/', 'drizzle-orm', `${S}/db`, `${S}/http/hono`],
          domain: ['hono', '@hono/', 'drizzle-orm', `${S}/db`, `${S}/http`, `${S}/env`],
          modules: ['drizzle-orm', `${S}/db`],
          lib: ['hono', '@hono/', 'drizzle-orm', `${S}/db`],
        },
      },
      // modules nie importuja innych modules (w ogole), services moga importowac inne services tylko przez index.ts
      siblings: [
        { dir: 'src/modules', publicFile: '' },
        { dir: 'src/services', publicFile: 'index.ts' },
      ],
    },
    [`${S}/web`]: {
      dir: 'apps/web',
      siblings: [{ dir: 'src/features', publicFile: 'index.ts' }],
      noFeatureImportsFrom: ['src/components/ui/**', 'src/components/shared/**', 'src/lib/**'],
    },
  },

  // Folder na jednostke (funkcje, komponenty, moduly): w tych katalogach kazda jednostka to <katalog>/<nazwa>/ z
  // <nazwa>.ts(x), testami, pomocnikami i index.ts (publiczne API); import tylko przez folder. Katalog z listy lezacy
  // w innym katalogu z listy (lib/utils w lib) jest grupa: sam nie jest jednostka, jego podfoldery sa.
  // Poza lista zostaja src/routes (konwencje routingu TanStack) i services/modules/repositories (po folderze na obszar).
  folderUnits: {
    dirs: [
      'apps/server/src/domain',
      'apps/server/src/lib',
      'apps/server/src/infrastructure',
      'apps/web/src/entry',
      'apps/web/src/components/ui',
      'apps/web/src/components/shared',
      'apps/web/src/lib',
      'apps/web/src/lib/hooks',
      'apps/web/src/lib/utils',
      'apps/web/src/lib/query',
      'apps/web/src/lib/rpc',
      'apps/web/src/features/*/components',
      'packages/cache/src',
      'packages/start-kit/src',
      'tools/architecture-check/src',
      'tools/architecture-check/src/rules',
      'tools/docs-check/src',
      'tools/bdot-import/src',
    ],
    allowRootFiles: ['index.ts'],
    ignore: [],
  },

  // web zna serwer tylko przez typy (AppType) i HTTP - poza wejsciem jedynego Workera, ktore montuje API i cron
  // (oraz kolejki i Workflow, gdy je dodasz) (`@app/server/worker`). Zaden inny plik web nie importuje kodu serwera.
  typeOnlyImports: [
    {
      from: `${S}/web`,
      to: `${S}/server`,
      runtime: { files: ['src/worker.ts', 'src/entry/**'], specifiers: [`${S}/server/worker`] },
    },
  ],
  dynamicImports: {
    allow: ['apps/web/src/**', 'apps/server/src/infrastructure/**'],
  },
  deepImports: {
    allowSubpaths: [
      `${S}/http/hono`,
      `${S}/env/server`,
      `${S}/start-kit/worker`,
      `${S}/db/schema`,
      `${S}/server/types`,
      // wejscie serwera dla jedynego Workera (apps/web/src/worker.ts) - patrz typeOnlyImports.runtime
      `${S}/server/worker`,
    ],
  },
});
