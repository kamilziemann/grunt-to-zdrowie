import { describe, expect, it } from 'vitest';

import { extractBuiltinCalls, extractBunScripts, extractPaths, extractSkills } from './doc-refs';

describe('extractPaths', () => {
  it('bierze sciezki repo, pomija szablony, paczki, adresy i bloki kodu', () => {
    const md = [
      'Zobacz `apps/server/src/container.ts:12` i `architecture.config.ts`.',
      'Szablon `src/features/<obszar>` oraz `@app/http/hono` i `https://x.dev/a`.',
      '```',
      '`apps/nope.ts`',
      '```',
      'Katalog `docs/plans/`.',
    ].join('\n');

    expect(extractPaths(md)).toEqual([
      { value: 'apps/server/src/container.ts', line: 1 },
      { value: 'architecture.config.ts', line: 1 },
      { value: 'docs/plans', line: 6 },
    ]);
  });
});

describe('extractBunScripts', () => {
  it('skrypty z bun i bun run, bez wbudowanych i --cwd', () => {
    const md = 'Uruchom `bun check` i `bun run db:migrate`, `bun install`, `bun run --cwd apps/web test`.';

    expect(extractBunScripts(md).map((r) => r.value)).toEqual(['check', 'db:migrate']);
  });

  it('`bun run <wbudowana>` to skrypt, `bun <wbudowana>` nie', () => {
    const md = 'Testy: `bun run test`, `bun test`, `bun run build`, `bun build`, `bun test:e2e`.';

    expect(extractBunScripts(md).map((r) => r.value)).toEqual(['test', 'build', 'test:e2e']);
  });
});

describe('extractBuiltinCalls', () => {
  it('wbudowane komendy bez argumentow (span, tabela, blok kodu); z argumentem albo przez run - nie', () => {
    const md = [
      '| `bun test` | vitest |',
      '`bun build`, `bun run test`, `bun test:e2e`, `bun test ./tools/scripts`, `bun x oxlint`.',
      '```bash',
      'bun install && bun check',
      'bun test          # wszystkie paczki',
      '```',
    ].join('\n');

    expect(extractBuiltinCalls(md)).toEqual([
      { value: 'test', line: 1 },
      { value: 'build', line: 2 },
      { value: 'install', line: 4 },
      { value: 'test', line: 5 },
    ]);
  });
});

describe('extractSkills', () => {
  it('nazwy po slowie skill', () => {
    const md = 'Uzyj skill `write-plan`; skille `new-server-module`, `db-change` i `verify-change`.';

    expect(extractSkills(md).map((r) => r.value)).toEqual([
      'write-plan',
      'new-server-module',
      'db-change',
      'verify-change',
    ]);
  });
});
