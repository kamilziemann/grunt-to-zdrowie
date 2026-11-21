import { describe, expect, it } from 'vitest';

import { checkDocs, projectSkills, type RepoFs } from './check-docs';

function memoryFs(files: Record<string, string>, scripts: Record<string, string[]> = {}): RepoFs {
  const paths = Object.keys(files);

  return {
    exists: (path) => paths.some((p) => p === path || p.startsWith(`${path}/`)),
    read: (path) => files[path] ?? '',
    markdownUnder: (dir) => paths.filter((p) => p.startsWith(`${dir}/`) && p.endsWith('.md')),
    scripts: (dir) => scripts[dir] ?? [],
  };
}

const README = '## Skille projektowe (nasze)\n\n| Skill |\n| --- |\n| `write-plan` |\n\n## Inne\n';

describe('checkDocs', () => {
  it('zglasza brakujace sciezki, skrypty, skille i reguly', () => {
    const fs = memoryFs(
      {
        'AGENTS.md':
          'Regula `cycles`. Plik `apps/server/src/container.ts` i `apps/server/src/gone.ts`. `bun check`.',
        'CLAUDE.md': 'skill `write-plan`, skill `missing-skill`; `bun nope`',
        'README.md': '',
        '.agents/README.md': README,
        '.agents/skills/write-plan/SKILL.md': 'Plan w `docs/plans`.',
        'apps/server/src/container.ts': '',
        'docs/plans/README.md': '',
      },
      { '': ['check'] },
    );

    expect(checkDocs(fs, { ruleIds: ['cycles', 'layers'] }).map((p) => `${p.file}: ${p.message}`)).toEqual([
      'AGENTS.md: sciezka `apps/server/src/gone.ts` nie istnieje',
      'CLAUDE.md: skrypt `bun nope` nie istnieje w package.json',
      'CLAUDE.md: skill `missing-skill` nie istnieje w .agents/skills',
      'AGENTS.md: regula architecture-check `layers` nie jest opisana',
    ]);
  });

  it('sciezki wzgledem aplikacji i katalogu dokumentu sa poprawne', () => {
    const fs = memoryFs({
      'AGENTS.md': '',
      'CLAUDE.md': '',
      'README.md': '',
      '.agents/README.md': README,
      'apps/server/AGENTS.md': 'Kontener `src/container.ts`, wejscia `entry/routes`.',
      'apps/server/src/container.ts': '',
      'apps/server/src/entry/routes/index.ts': '',
    });

    expect(checkDocs(fs, { ruleIds: [] })).toEqual([
      { file: '.agents/README.md', line: 0, message: 'skill projektowy `write-plan` nie istnieje' },
    ]);
  });

  it('zglasza `bun test`/`bun build`, gdy package.json ma skrypt o tej nazwie (Bun wola wlasna komende)', () => {
    const fs = memoryFs(
      {
        'AGENTS.md': '',
        'CLAUDE.md': '',
        'README.md': '| `bun build` | turbo |\n| `bun test` | vitest |\n`bun run test`, `bun install`',
        '.agents/README.md': README,
        '.agents/skills/write-plan/SKILL.md': '',
      },
      { '': ['build', 'test'] },
    );

    expect(checkDocs(fs, { ruleIds: [] })).toEqual([
      {
        file: 'README.md',
        line: 1,
        message:
          '`bun build` uruchamia wbudowana komende Buna, nie skrypt z package.json - napisz `bun run build`',
      },
      {
        file: 'README.md',
        line: 2,
        message:
          '`bun test` uruchamia wbudowana komende Buna, nie skrypt z package.json - napisz `bun run test`',
      },
    ]);
  });
});

describe('projectSkills', () => {
  it('czyta pierwsza kolumne tabeli tylko z sekcji projektowej', () => {
    expect(projectSkills(`${README}| \`other\` |\n`)).toEqual(['write-plan']);
  });
});
