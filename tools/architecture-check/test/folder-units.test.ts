// Regula folder-units: plik luzem w katalogu jednostek i import prywatnego pliku jednostki (na fixtures valid/invalid).
import { describe, expect, it } from 'vitest';

import type { ArchitectureConfig } from '../src/config';
import { runArchitectureCheck } from '../src/index';
import type { Violation } from '../src/types';
import invalidConfig from './fixtures/invalid/architecture.config';
import validConfig from './fixtures/valid/architecture.config';

const VALID_ROOT = `${import.meta.dirname}/fixtures/valid`;
const INVALID_ROOT = `${import.meta.dirname}/fixtures/invalid`;
const WIDGETS = 'apps/web/src/components/widgets';

const run = (config: ArchitectureConfig, root: string): Promise<Violation[]> =>
  runArchitectureCheck(config, root, { only: ['folder-units'] }).then((result) => result.violations);
const keys = (violations: readonly Violation[]): string[] =>
  violations.map((v) => `${v.file}:${v.line}`).toSorted();
const withFolderUnits = (
  config: ArchitectureConfig,
  folderUnits: ArchitectureConfig['folderUnits'],
): ArchitectureConfig => ({ ...config, folderUnits });

describe('folder-units: valid', () => {
  it('nie zglasza nic: jednostki w folderach, grupa forms, katalog packs ignorowany', async () => {
    expect(await run(validConfig, VALID_ROOT)).toEqual([]);
  });

  it('bez sekcji folderUnits regula jest wylaczona', async () => {
    expect(await run(withFolderUnits(invalidConfig, undefined), INVALID_ROOT)).toEqual([]);
  });

  it('katalog bez index.ts w allowRootFiles zglasza index.ts jako plik luzem (w katalogu i w grupie)', async () => {
    const config = withFolderUnits(validConfig, { ...validConfig.folderUnits!, allowRootFiles: [] });

    expect(keys(await run(config, VALID_ROOT))).toEqual([
      `${WIDGETS}/forms/index.ts:0`,
      `${WIDGETS}/index.ts:0`,
    ]);
  });

  it('bez ignore katalog packs jest jednostka: jej prywatny plik nie moze byc importowany z zewnatrz', async () => {
    const config = withFolderUnits(validConfig, { ...validConfig.folderUnits!, ignore: [] });
    const violations = await run(config, VALID_ROOT);

    expect(keys(violations)).toEqual([`${WIDGETS}/badge/badge.tsx:3`]);
    expect(violations[0]?.message).toContain(`${WIDGETS}/packs`);
  });

  it('globy w dirs: gwiazdka obejmuje kazdy katalog z jednostkami', async () => {
    const config = withFolderUnits(validConfig, {
      ...validConfig.folderUnits!,
      dirs: ['apps/web/src/components/*', `${WIDGETS}/forms`],
      allowRootFiles: ['index.ts'],
    });
    const violations = await run(config, VALID_ROOT);

    // components/ui trafilo na liste (gwiazdka), a button.tsx lezy w nim luzem; widgets pozostaje poprawny
    expect(keys(violations)).toEqual(['apps/web/src/components/ui/button.tsx:0']);
  });
});

describe('folder-units: invalid', () => {
  it('zglasza pliki luzem (takze test) i importy prywatnych plikow', async () => {
    const violations = await run(invalidConfig, INVALID_ROOT);

    expect(keys(violations)).toEqual(
      [
        `${WIDGETS}/stray.tsx:0`,
        `${WIDGETS}/stray.test.tsx:0`,
        `${WIDGETS}/chip/chip.tsx:3`,
        'apps/web/src/features/jobs/hooks/use-widgets.ts:2',
        'apps/web/src/features/jobs/hooks/use-widgets.ts:3',
      ].toSorted(),
    );
  });

  it('wskazuje docelowy folder dla pliku luzem', async () => {
    const violations = await run(invalidConfig, INVALID_ROOT);
    const stray = violations.find((v) => v.file === `${WIDGETS}/stray.tsx`);
    const strayTest = violations.find((v) => v.file === `${WIDGETS}/stray.test.tsx`);

    expect(stray?.message).toContain(`przenies go do ${WIDGETS}/stray/stray.tsx`);
    expect(strayTest?.message).toContain(`przenies go do ${WIDGETS}/stray/stray.test.tsx`);
  });

  it('wskazuje folder jednostki, a nie jej plik, dla importu prywatnego', async () => {
    const violations = await run(invalidConfig, INVALID_ROOT);
    const privateImport = violations.find((v) => v.file === `${WIDGETS}/chip/chip.tsx`);
    const nested = violations.find(
      (v) => v.file === 'apps/web/src/features/jobs/hooks/use-widgets.ts' && v.line === 3,
    );

    expect(privateImport?.message).toBe(
      `Import prywatnego pliku jednostki ${WIDGETS}/badge ('../badge/badge-label'). Importuj folder jednostki (${WIDGETS}/badge, czyli jej index.ts), nie pliki w srodku.`,
    );
    // import przez grupe (forms) do wnetrza jednostki input tez jest prywatny
    expect(nested?.message).toContain(`${WIDGETS}/forms/input`);
  });

  it('import wewnatrz folderu jednostki i import folderu (index.ts) sa dozwolone', async () => {
    const violations = await run(invalidConfig, INVALID_ROOT);

    expect(violations.some((v) => v.file === `${WIDGETS}/badge/badge.tsx`)).toBe(false);
    expect(violations.some((v) => v.file === `${WIDGETS}/index.ts`)).toBe(false);
  });
});
