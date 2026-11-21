// Konfiguracja fixture (mini-monorepo). Scope '@fx' celowo inny niz w repo - checker nie moze go zakladac.
import { defineArchitecture } from '../../../src/config';

const S = '@fx';

export default defineArchitecture({
  scope: S,
  include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}', 'tools/*/src/**/*.{ts,tsx}'],
  exclude: ['**/*.test.{ts,tsx}', '**/test/**', '**/node_modules/**'],
  packages: {
    [`${S}/contracts`]: { dir: 'packages/contracts', allowed: [] },
    [`${S}/logger`]: { dir: 'packages/logger', allowed: [] },
    [`${S}/http`]: { dir: 'packages/http', allowed: [`${S}/contracts`, `${S}/logger`] },
    [`${S}/env`]: { dir: 'packages/env', allowed: [`${S}/contracts`] },
    [`${S}/db`]: { dir: 'packages/db', allowed: [`${S}/contracts`] },
    [`${S}/rpc`]: { dir: 'packages/rpc', allowed: [`${S}/contracts`] },
    [`${S}/engine`]: { dir: 'packages/engine', allowed: [`${S}/contracts`] },
    [`${S}/testing`]: { dir: 'packages/testing', allowed: [`${S}/contracts`] },
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
          services: ['hono', '@hono/', 'drizzle-orm', `${S}/db`, `${S}/http/hono`],
          domain: ['hono', '@hono/', 'drizzle-orm', `${S}/db`, `${S}/http`, `${S}/env`],
          modules: ['drizzle-orm', `${S}/db`],
          lib: ['hono', '@hono/', 'drizzle-orm', `${S}/db`],
        },
      },
      siblings: [
        { dir: 'src/modules', publicFile: '' },
        { dir: 'src/services', publicFile: 'index.ts' },
      ],
    },
    [`${S}/web`]: {
      dir: 'apps/web',
      siblings: [{ dir: 'src/features', publicFile: 'index.ts' }],
      serverOnly: ['src/features/*/server/**', 'src/lib/server/**'],
      noFeatureImportsFrom: ['src/components/ui/**', 'src/components/shared/**', 'src/lib/**'],
    },
  },
  folderUnits: {
    // widgets to katalog jednostek; forms jest grupa (lezy w widgets i sam jest na liscie); packs to dane, nie jednostka
    dirs: ['apps/web/src/components/widgets', 'apps/web/src/components/widgets/forms'],
    allowRootFiles: ['index.ts'],
    ignore: ['apps/web/src/components/widgets/packs'],
  },
  typeOnlyImports: [
    {
      from: `${S}/web`,
      to: `${S}/server`,
      runtime: { files: ['src/worker.ts', 'src/entry/**'], specifiers: [`${S}/server/worker`] },
    },
  ],
  dynamicImports: {
    allow: ['apps/web/src/**', 'packages/engine/src/browser/**', 'apps/server/src/infrastructure/**'],
  },
  deepImports: {
    allowSubpaths: [
      `${S}/http/hono`,
      `${S}/env/web`,
      `${S}/engine/browser`,
      `${S}/db/schema`,
      `${S}/server/types`,
      `${S}/testing/fixtures/`,
    ],
  },
});
