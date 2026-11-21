// Testy regul pluginu przez RuleTester z `oxlint/plugins-dev` (prawdziwy parser oxc, prawdziwe raportowanie).
// Sciezki plikow sa absolutne w stylu Windows; reguly normalizuja separatory i patrza tylko na segmenty sciezki.
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../src/index.js';

// RuleTester sam wyprowadza `itOnly` z `it.only`.
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();
const file = (path: string): string => `C:/dev/app/${path}`;

const FEATURE_A = file('apps/web/src/features/a/components/list.tsx');
const FEATURE_A_INDEX = file('apps/web/src/features/a/index.ts');
const ROUTE = file('apps/web/src/routes/{-$locale}/_app/index.tsx');
const UI = file('apps/web/src/components/ui/button.tsx');
const PACKAGE_RPC = file('packages/rpc/src/index.ts');
const PACKAGE_DB = file('packages/db/src/client.ts');
const TOOL_FONTS = file('tools/fonts/src/cli.ts');
const SERVER_MODULE = file('apps/server/src/modules/jobs/routes.ts');

const crossFeature = /Import wnetrza feature 'b'/;

tester.run('no-cross-feature-import', plugin.rules['no-cross-feature-import'], {
  valid: [
    { filename: FEATURE_A, code: "import { useList } from '../hooks/use-list';" },
    { filename: FEATURE_A, code: "import { Thing } from '@/features/b';" },
    { filename: FEATURE_A, code: "import { Thing } from '@/features/b/index';" },
    { filename: FEATURE_A, code: "import { Thing } from '../../b';" },
    { filename: FEATURE_A, code: "import { Thing } from '../../b/index.ts';" },
    { filename: FEATURE_A, code: "export { Thing } from '@/features/b';" },
    { filename: FEATURE_A, code: "const mod = await import('@/features/b');" },
    { filename: FEATURE_A, code: "import { Button } from '@/components/ui/button';" },
    { filename: FEATURE_A, code: "import { z } from 'zod';" },
    { filename: FEATURE_A_INDEX, code: "export { List } from './components/list';" },
    // pliki spoza features (routing, komponenty wspolne) moga siegac do wnetrza feature - tym zajmuje sie architecture-check
    { filename: ROUTE, code: "import { loadJobs } from '@/features/b/server/loader';" },
    { filename: UI, code: "import { x } from '@/features/b/internal';" },
    { filename: SERVER_MODULE, code: "import { x } from '../render/routes';" },
    { filename: FEATURE_A, code: 'const mod = await import(dynamicName);' },
  ],
  invalid: [
    {
      filename: FEATURE_A,
      code: "import { Thing } from '@/features/b/components/thing';",
      errors: [{ message: crossFeature }],
    },
    {
      filename: FEATURE_A,
      code: "import { useB } from '../../b/hooks/use-b';",
      errors: [{ message: crossFeature }],
    },
    {
      filename: FEATURE_A,
      code: "import type { B } from '@/features/b/types';",
      errors: [{ message: crossFeature }],
    },
    {
      filename: FEATURE_A,
      code: "export * from '@/features/b/internal';",
      errors: [{ message: crossFeature }],
    },
    {
      filename: FEATURE_A,
      code: "export { x } from '../../b/server/loader';",
      errors: [{ message: crossFeature }],
    },
    {
      filename: FEATURE_A,
      code: "const mod = await import('../../b/server/loader');",
      errors: [{ message: crossFeature }],
    },
    {
      filename: FEATURE_A_INDEX,
      code: "import { a } from '@/features/b/a';\nimport { c } from '@/features/c/x';",
      errors: [{ message: crossFeature }, { message: /Import wnetrza feature 'c'/ }],
    },
  ],
});

const deep = /Gleboki import/;

tester.run('no-deep-package-import', plugin.rules['no-deep-package-import'], {
  valid: [
    { filename: ROUTE, code: "import { parcelSchema } from '@app/contracts';" },
    { filename: ROUTE, code: "import { schema } from '@app/db/schema';" },
    { filename: SERVER_MODULE, code: "import { createErrorHandler } from '@app/http/hono';" },
    { filename: SERVER_MODULE, code: "import { parseServerVars } from '@app/env/server';" },
    { filename: ROUTE, code: "import { parseServerVars } from '@app/env/server';" },
    { filename: ROUTE, code: "import type { AppType } from '@app/server/types';" },
    { filename: ROUTE, code: "import { user } from '@app/db/schema';" },
    { filename: ROUTE, code: "import { hc } from 'hono/client';" },
    { filename: ROUTE, code: "import { deep } from '@other/pkg/src/deep';" },
    { filename: ROUTE, code: "import { local } from './local/deep/path';" },
  ],
  invalid: [
    {
      filename: ROUTE,
      code: "import { user } from '@app/db/src/schema';",
      errors: [{ message: deep }],
    },
    {
      filename: SERVER_MODULE,
      code: "import { x } from '@app/contracts/src/parcel';",
      errors: [{ message: deep }],
    },
    {
      filename: SERVER_MODULE,
      code: "import { x } from '@app/http/hono/extra';",
      errors: [{ message: deep }],
    },
    { filename: ROUTE, code: "export * from '@app/engine/src/index';", errors: [{ message: deep }] },
    {
      filename: ROUTE,
      code: "const m = await import('@app/engine/src/browser/player');",
      errors: [{ message: deep }],
    },
    { filename: ROUTE, code: "import type { X } from '@app/rpc/src/index';", errors: [{ message: deep }] },
  ],
});

const appImport = /Paczka importuje aplikacje/;

tester.run('no-app-import-in-package', plugin.rules['no-app-import-in-package'], {
  valid: [
    { filename: PACKAGE_RPC, code: "import { PROBLEM_CODES } from '@app/contracts';" },
    { filename: PACKAGE_RPC, code: "import { hc } from 'hono/client';" },
    { filename: PACKAGE_DB, code: "import * as schema from './schema';" },
    { filename: TOOL_FONTS, code: "import type { FontPack } from '@app/engine';" },
    // aplikacje moga importowac aplikacje (regula type-only jest w architecture-check)
    { filename: ROUTE, code: "import type { AppType } from '@app/server/types';" },
    { filename: SERVER_MODULE, code: "import { x } from '@app/web';" },
    {
      filename: file('packages/db/scripts/check-migrations.ts'),
      code: "import { x } from '@app/server';",
    },
  ],
  invalid: [
    {
      filename: PACKAGE_RPC,
      code: "import type { AppType } from '@app/server/types';",
      errors: [{ message: appImport }],
    },
    { filename: PACKAGE_RPC, code: "import app from '@app/server';", errors: [{ message: appImport }] },
    { filename: TOOL_FONTS, code: "import { x } from '@app/web';", errors: [{ message: appImport }] },
    {
      filename: PACKAGE_DB,
      code: "import { nowIso } from '../../../apps/server/src/lib/time';",
      errors: [{ message: appImport }],
    },
    { filename: PACKAGE_DB, code: "export * from '@app/server';", errors: [{ message: appImport }] },
    {
      filename: PACKAGE_RPC,
      code: "const m = await import('@app/web');",
      errors: [{ message: appImport }],
    },
  ],
});
