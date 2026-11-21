// Testy end-to-end na mini-monorepo z test/fixtures: valid = 0 naruszen, invalid = dokladnie ten zbior.
import { describe, expect, it } from 'vitest';

import type { ArchitectureConfig } from '../src/config';
import { runArchitectureCheck } from '../src/index';
import type { Violation } from '../src/types';
import invalidConfig from './fixtures/invalid/architecture.config';
import validConfig from './fixtures/valid/architecture.config';

const VALID_ROOT = `${import.meta.dirname}/fixtures/valid`;
const INVALID_ROOT = `${import.meta.dirname}/fixtures/invalid`;

const key = (v: Violation): string => `${v.rule} ${v.file}:${v.line}`;
const keys = (violations: readonly Violation[]): string[] => violations.map(key).toSorted();

const EXPECTED_INVALID = [
  'package-deps packages/contracts/src/index.ts:1',
  'package-deps packages/db/src/schema.ts:1',
  'package-deps packages/extra/src/index.ts:0',
  'no-app-import packages/env/src/web.ts:1',
  'no-app-import packages/rpc/src/index.ts:1',
  'no-app-import tools/fonts/src/cli.ts:1',
  'deep-import apps/web/src/features/jobs/hooks/use-jobs.ts:2',
  'deep-import packages/db/src/index.ts:1',
  'deep-import packages/env/src/web.ts:1',
  'deep-import packages/testing/src/index.ts:1',
  'cycles apps/server/src/lib/format.ts:1',
  'cycles packages/engine/src/browser/index.ts:1',
  'layers apps/server/src/domain/job.ts:1',
  'layers apps/server/src/modules/jobs/routes.ts:4',
  'layers apps/server/src/repositories/jobs.ts:1',
  'layers apps/server/src/services/jobs/create-job.ts:2',
  'forbidden-modules apps/server/src/domain/job.ts:2',
  'forbidden-modules apps/server/src/modules/jobs/routes.ts:2',
  'forbidden-modules apps/server/src/services/jobs/create-job.ts:1',
  'siblings apps/server/src/modules/jobs/routes.ts:3',
  'siblings apps/server/src/services/jobs/create-job.ts:3',
  'siblings apps/web/src/features/catalog/index.ts:1',
  'folder-units apps/web/src/components/widgets/stray.tsx:0',
  'folder-units apps/web/src/components/widgets/stray.test.tsx:0',
  'folder-units apps/web/src/components/widgets/chip/chip.tsx:3',
  'folder-units apps/web/src/features/jobs/hooks/use-widgets.ts:2',
  'folder-units apps/web/src/features/jobs/hooks/use-widgets.ts:3',
  'type-only apps/server/src/entry/app.ts:3',
  'type-only apps/web/src/features/jobs/hooks/use-jobs.ts:1',
  'type-only apps/web/src/lib/server-handle.ts:1',
  'dynamic-import apps/server/src/modules/jobs/routes.ts:5',
  'dynamic-import packages/engine/src/index.ts:3',
  'server-client apps/web/src/components/ui/button.tsx:2',
  'server-client apps/web/src/features/jobs/components/job-list.tsx:2',
  'server-client apps/web/src/lib/utils.ts:1',
].toSorted();

describe('fixture: valid', () => {
  it('nie zglasza zadnych naruszen', async () => {
    const result = await runArchitectureCheck(validConfig, VALID_ROOT);

    expect(keys(result.violations)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.filesScanned).toBeGreaterThan(30);
  });

  it('pomija pliki z exclude (testy i katalogi test/)', async () => {
    const result = await runArchitectureCheck(validConfig, VALID_ROOT);
    const scannedTestFiles = result.violations.filter(
      (v) => v.file.includes('.test.') || v.file.includes('/test/'),
    );

    expect(scannedTestFiles).toEqual([]);
  });
});

describe('fixture: invalid', () => {
  it('zglasza dokladnie oczekiwany zbior naruszen (regula, plik, linia)', async () => {
    const result = await runArchitectureCheck(invalidConfig, INVALID_ROOT);

    expect(keys(result.violations)).toEqual(EXPECTED_INVALID);
    expect(result.ok).toBe(false);
    expect(result.counts).toEqual({
      'package-deps': 3,
      'no-app-import': 3,
      'deep-import': 4,
      cycles: 2,
      layers: 4,
      'forbidden-modules': 3,
      siblings: 3,
      'folder-units': 5,
      'type-only': 3,
      'dynamic-import': 2,
      'server-client': 3,
    });
  });

  it('opisuje cykl pelna sciezka i raportuje go raz', async () => {
    const result = await runArchitectureCheck(invalidConfig, INVALID_ROOT, { only: ['cycles'] });
    const messages = result.violations.map((v) => v.message);

    expect(messages).toHaveLength(2);
    expect(messages).toContain(
      'Cykl importow: apps/server/src/lib/format.ts -> apps/server/src/lib/time.ts -> apps/server/src/lib/format.ts.',
    );
  });

  it('--only ogranicza zbior regul', async () => {
    const result = await runArchitectureCheck(invalidConfig, INVALID_ROOT, { only: ['layers', 'siblings'] });

    expect(new Set(result.violations.map((v) => v.rule))).toEqual(new Set(['layers', 'siblings']));
    expect(result.violations).toHaveLength(7);
  });

  it('odrzuca nieznane identyfikatory regul', async () => {
    await expect(runArchitectureCheck(invalidConfig, INVALID_ROOT, { only: ['nope'] })).rejects.toThrow(
      /Nieznane reguly: nope/,
    );
  });

  it('sortuje naruszenia wedlug reguly, pliku i linii', async () => {
    const result = await runArchitectureCheck(invalidConfig, INVALID_ROOT);
    const rules = result.violations.map((v) => v.rule);
    const firstIndex = new Map<string, number>();

    rules.forEach((rule, i) => {
      if (!firstIndex.has(rule)) firstIndex.set(rule, i);
    });
    expect([...firstIndex.keys()]).toEqual([
      'package-deps',
      'no-app-import',
      'deep-import',
      'cycles',
      'layers',
      'forbidden-modules',
      'siblings',
      'folder-units',
      'type-only',
      'dynamic-import',
      'server-client',
    ]);
  });
});

describe('walidacja konfiguracji', () => {
  const S = validConfig.scope;

  it('wykrywa cykl i nieznane paczki w grafie allowed', async () => {
    const config: ArchitectureConfig = {
      ...validConfig,
      packages: {
        ...validConfig.packages,
        [`${S}/contracts`]: { dir: 'packages/contracts', allowed: [`${S}/http`, `${S}/missing`] },
      },
    };
    const result = await runArchitectureCheck(config, VALID_ROOT, {
      only: ['package-deps'],
      configPath: 'arch.ts',
    });
    const configProblems = result.violations.filter((v) => v.file === 'arch.ts');

    expect(configProblems.map((v) => v.message).toSorted()).toEqual(
      [
        `Paczka ${S}/contracts: 'allowed' wskazuje nieznana paczke ${S}/missing.`,
        `Cykl w grafie paczek (allowed): ${S}/contracts -> ${S}/http -> ${S}/contracts.`,
      ].toSorted(),
    );
  });

  it('wykrywa nieznane warstwy i aplikacje w konfiguracji', async () => {
    const server = validConfig.apps[`${S}/server`];

    if (!server?.layers) throw new Error('fixture bez warstw');
    const config: ArchitectureConfig = {
      ...validConfig,
      apps: {
        ...validConfig.apps,
        [`${S}/server`]: {
          ...server,
          layers: {
            ...server.layers,
            allowed: {
              ...server.layers.allowed,
              ghost: ['domain'],
              entry: [...(server.layers.allowed.entry ?? []), 'nope'],
            },
            forbiddenModules: { ...server.layers.forbiddenModules, phantom: ['hono'] },
          },
        },
      },
      typeOnlyImports: [{ from: `${S}/web`, to: `${S}/mobile` }],
    };
    const result = await runArchitectureCheck(config, VALID_ROOT);
    const configProblems = result.violations
      .filter((v) => v.line === 0)
      .map((v) => `${v.rule}: ${v.message}`);

    expect(configProblems).toEqual([
      `layers: ${S}/server: 'allowed' wskazuje nieznana warstwe 'ghost'.`,
      `layers: ${S}/server: warstwa 'entry' dopuszcza nieznana warstwe 'nope'.`,
      `forbidden-modules: ${S}/server: forbiddenModules wskazuje nieznana warstwe 'phantom'.`,
      `type-only: typeOnlyImports wskazuje nieznana aplikacje ${S}/mobile.`,
    ]);
  });
});
