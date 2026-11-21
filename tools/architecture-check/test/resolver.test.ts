// Resolver na wirtualnym systemie plikow: sciezki wzgledne, alias @/, paczki workspace z exports, moduly zewnetrzne.
import { describe, expect, it } from 'vitest';

import type { ArchitectureConfig } from '../src/config';
import { createResolver } from '../src/resolver';
import type { WorkspaceUnit } from '../src/types';
import { parseExports } from '../src/workspace';

const config: ArchitectureConfig = {
  scope: '@fx',
  include: [],
  exclude: [],
  packages: {
    '@fx/db': { dir: 'packages/db', allowed: [] },
    '@fx/testing': { dir: 'packages/testing', allowed: [] },
  },
  apps: { '@fx/web': { dir: 'apps/web' }, '@fx/server': { dir: 'apps/server' } },
  typeOnlyImports: [],
  dynamicImports: { allow: [] },
  deepImports: { allowSubpaths: [] },
};

const unit = (
  name: string,
  dir: string,
  kind: WorkspaceUnit['kind'],
  exportsField?: unknown,
): WorkspaceUnit => ({
  name,
  dir,
  kind,
  declared: true,
  exports: parseExports(exportsField, dir),
  main: null,
});

const units: WorkspaceUnit[] = [
  unit('@fx/db', 'packages/db', 'package', {
    '.': { types: './src/index.ts', default: './src/index.ts' },
    './schema': './src/schema.ts',
  }),
  unit('@fx/testing', 'packages/testing', 'package', {
    '.': './src/index.ts',
    './fixtures/*': './fixtures/*',
  }),
  unit('@fx/web', 'apps/web', 'app'),
  unit('@fx/server', 'apps/server', 'app', { './types': { types: './src/types.ts' } }),
  unit('@fx/fonts', 'tools/fonts', 'tool'),
];

const files = new Set([
  'packages/db/src/index.ts',
  'packages/db/src/schema.ts',
  'packages/db/src/internal/hidden.ts',
  'packages/testing/src/index.ts',
  'packages/testing/fixtures/fso.story.json',
  'apps/web/src/app/page.tsx',
  'apps/web/src/lib/utils.ts',
  'apps/web/src/features/jobs/index.ts',
  'apps/web/src/features/jobs/components/list.tsx',
  'apps/web/src/styles.css',
  'apps/server/src/index.ts',
  'apps/server/src/types.ts',
  'apps/server/src/lib/time.ts',
  'tools/fonts/src/cli.ts',
]);

const resolver = createResolver({ root: '/virtual', config, units, isFile: (path) => files.has(path) });

describe('createResolver: sciezki wzgledne', () => {
  it('dodaje rozszerzenia .ts/.tsx i index.*', () => {
    const fromPage = 'apps/web/src/app/page.tsx';

    expect(resolver.resolve(fromPage, '../lib/utils')).toMatchObject({
      kind: 'file',
      path: 'apps/web/src/lib/utils.ts',
    });
    expect(resolver.resolve(fromPage, '../features/jobs')).toMatchObject({
      kind: 'file',
      path: 'apps/web/src/features/jobs/index.ts',
    });
    expect(resolver.resolve(fromPage, '../features/jobs/components/list')).toMatchObject({
      path: 'apps/web/src/features/jobs/components/list.tsx',
    });
  });

  it('mapuje .js na .ts (ESM-owe specyfikatory)', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '../lib/utils.js')).toMatchObject({
      kind: 'file',
      path: 'apps/web/src/lib/utils.ts',
    });
  });

  it('zachowuje jawne rozszerzenia (css, json)', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '../styles.css')).toMatchObject({
      kind: 'file',
      path: 'apps/web/src/styles.css',
    });
  });

  it('zwraca unresolved z kandydatem, gdy pliku nie ma', () => {
    const result = resolver.resolve('apps/web/src/app/page.tsx', '../lib/missing');

    expect(result.kind).toBe('unresolved');
    expect(result.path).toBe('apps/web/src/lib/missing');
    expect(result.unit?.name).toBe('@fx/web');
  });

  it('oznacza import wzgledny wychodzacy poza jednostke', () => {
    const result = resolver.resolve('packages/db/src/index.ts', '../../../apps/server/src/lib/time');

    expect(result).toMatchObject({ kind: 'file', path: 'apps/server/src/lib/time.ts', crossesUnit: true });
    expect(result.unit?.name).toBe('@fx/server');
    expect(resolver.resolve('packages/db/src/index.ts', './schema').crossesUnit).toBe(false);
  });

  it('nie wychodzi ponad root', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '../../../../../etc/passwd').kind).toBe(
      'unresolved',
    );
  });
});

describe('createResolver: alias @/', () => {
  it('wskazuje <app>/src tylko w aplikacjach', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '@/lib/utils')).toMatchObject({
      kind: 'file',
      path: 'apps/web/src/lib/utils.ts',
      crossesUnit: false,
    });
    expect(resolver.resolve('packages/db/src/index.ts', '@/lib/utils').kind).toBe('unresolved');
  });
});

describe('createResolver: paczki workspace', () => {
  it('rozwiazuje import glowny przez exports["."]', () => {
    const result = resolver.resolve('apps/web/src/app/page.tsx', '@fx/db');

    expect(result).toMatchObject({
      kind: 'workspace',
      path: 'packages/db/src/index.ts',
      subpath: null,
      exported: true,
    });
    expect(result.unit?.name).toBe('@fx/db');
  });

  it('rozwiazuje subpath z exports i oznacza go jako exported', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '@fx/db/schema')).toMatchObject({
      kind: 'workspace',
      path: 'packages/db/src/schema.ts',
      subpath: 'schema',
      exported: true,
    });
    expect(resolver.resolve('apps/web/src/app/page.tsx', '@fx/server/types')).toMatchObject({
      path: 'apps/server/src/types.ts',
      exported: true,
    });
  });

  it('obsluguje wzorce exports z gwiazdka', () => {
    expect(
      resolver.resolve('apps/web/src/app/page.tsx', '@fx/testing/fixtures/fso.story.json'),
    ).toMatchObject({
      path: 'packages/testing/fixtures/fso.story.json',
      subpath: 'fixtures/fso.story.json',
      exported: true,
    });
  });

  it('oznacza gleboki import (poza exports) i mimo to znajduje plik', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '@fx/db/src/internal/hidden')).toMatchObject({
      kind: 'workspace',
      path: 'packages/db/src/internal/hidden.ts',
      subpath: 'src/internal/hidden',
      exported: false,
    });
  });

  it('aplikacja bez exports: import glowny przez src/index', () => {
    expect(resolver.resolve('packages/db/src/index.ts', '@fx/server')).toMatchObject({
      kind: 'workspace',
      path: 'apps/server/src/index.ts',
      exported: true,
    });
    expect(resolver.resolve('packages/db/src/index.ts', '@fx/web')).toMatchObject({
      kind: 'workspace',
      path: null,
    });
  });

  it('nieznana paczka ze scope to modul zewnetrzny', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '@fx/tsconfig/base.json').kind).toBe('external');
  });
});

describe('createResolver: moduly zewnetrzne', () => {
  it('klasyfikuje bare specifiers i prefiksy runtime', () => {
    for (const spec of [
      'hono',
      'hono/client',
      '@hono/zod-openapi',
      'node:fs',
      'bun:test',
      'cloudflare:workers',
    ]) {
      expect(resolver.resolve('apps/web/src/app/page.tsx', spec).kind).toBe('external');
    }
  });

  it('sciezki absolutne sa unresolved', () => {
    expect(resolver.resolve('apps/web/src/app/page.tsx', '/etc/hosts').kind).toBe('unresolved');
    expect(resolver.resolve('apps/web/src/app/page.tsx', 'C:/dev/x').kind).toBe('unresolved');
  });

  it('unitOf wybiera najdluzszy pasujacy katalog', () => {
    expect(resolver.unitOf('tools/fonts/src/cli.ts')?.name).toBe('@fx/fonts');
    expect(resolver.unitOf('architecture.config.ts')).toBeNull();
  });
});

describe('parseExports', () => {
  it('obsluguje string, obiekt warunkow i mape subpathow', () => {
    expect(parseExports('./src/index.ts', 'packages/x')).toEqual(new Map([['.', 'packages/x/src/index.ts']]));
    expect(parseExports({ types: './src/index.d.ts', default: './src/index.ts' }, 'packages/x')).toEqual(
      new Map([['.', 'packages/x/src/index.d.ts']]),
    );
    expect(
      parseExports({ '.': './src/index.ts', './sub': { default: './src/sub.ts' } }, 'packages/x'),
    ).toEqual(
      new Map([
        ['.', 'packages/x/src/index.ts'],
        ['sub', 'packages/x/src/sub.ts'],
      ]),
    );
    expect(parseExports(undefined, 'packages/x')).toBeNull();
  });
});
