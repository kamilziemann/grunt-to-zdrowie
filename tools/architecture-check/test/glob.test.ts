// Semantyka globow, na ktorej opiera sie konfiguracja (Bun.Glob): `**` = 0..n katalogow, `*` nie przekracza `/`.
import { describe, expect, it } from 'vitest';

import { matchGlob, matchesAny, scanPaths } from '../src/glob';

describe('matchGlob', () => {
  it('dopasowuje globy warstw i wykluczen', () => {
    expect(matchGlob('src/modules/**', 'src/modules/jobs/routes.ts')).toBe(true);
    expect(matchGlob('src/modules/**', 'src/modules/flat.ts')).toBe(true);
    expect(matchGlob('src/modules/**', 'src/modulesx/flat.ts')).toBe(false);
    expect(matchGlob('src/*.ts', 'src/index.ts')).toBe(true);
    expect(matchGlob('src/*.ts', 'src/lib/index.ts')).toBe(false);
    expect(matchGlob('**/*.test.{ts,tsx}', 'packages/db/src/ids.test.ts')).toBe(true);
    expect(matchGlob('**/*.test.{ts,tsx}', 'ids.test.tsx')).toBe(true);
    expect(matchGlob('**/test/**', 'apps/server/test/helpers.ts')).toBe(true);
    expect(matchGlob('src/features/*/server/**', 'src/features/jobs/server/loader.ts')).toBe(true);
    expect(matchGlob('src/features/*/server/**', 'src/features/jobs/hooks/loader.ts')).toBe(false);
  });

  it('matchesAny sprawdza liste wzorcow', () => {
    expect(matchesAny(['a/**', 'b/**'], 'b/x.ts')).toBe(true);
    expect(matchesAny([], 'b/x.ts')).toBe(false);
  });
});

describe('scanPaths', () => {
  it('zwraca posortowane sciezki POSIX z include minus exclude', () => {
    const root = `${import.meta.dirname}/fixtures/valid`;
    const paths = scanPaths(root, ['apps/server/src/**/*.ts'], ['**/*.test.{ts,tsx}']);

    expect(paths).toContain('apps/server/src/lib/time.ts');
    expect(paths).not.toContain('apps/server/src/lib/time.test.ts');
    expect(paths.every((p) => !p.includes('\\'))).toBe(true);
    expect(paths).toEqual([...paths].toSorted());
  });
});
