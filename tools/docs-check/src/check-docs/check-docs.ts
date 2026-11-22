// Reguly zgodnosci dokumentacji z repo. Dostep do plikow przez interfejs `RepoFs`, zeby testy dzialaly w pamieci.
import { extractBuiltinCalls, extractBunScripts, extractPaths, extractSkills } from '../doc-refs';

export interface RepoFs {
  exists(path: string): boolean;
  read(path: string): string;
  /** pliki .md pod katalogiem (rekurencyjnie), sciezki wzgledem roota */
  markdownUnder(dir: string): string[];
  /** nazwy skryptow z package.json w danym katalogu ('' = root); brak pliku = [] */
  scripts(dir: string): string[];
}

export interface DocProblem {
  file: string;
  line: number;
  message: string;
}

/** Generowane/lokalne katalogi - wspominane w docs, ale nie ma ich w repo. */
const IGNORED_PREFIXES = [
  '.taste-skill',
  'assets',
  '.wrangler',
  '.next',
  '.open-next',
  '.turbo',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
  '.claude/worktrees',
  'apps/server/.dev.vars',
  'apps/server/.wrangler',
  'apps/web/.next',
  // dokumentacja robocza trzymana lokalnie (.gitignore) - agenci do niej pisza, ale nie ma jej w repo
  'docs/progress',
  'docs/plans',
  'docs/architecture',
  'docs/research',
  'docs/project-status.md',
];

/** Bazy, wzgledem ktorych dokumenty podaja sciezki (root, katalog dokumentu, aplikacje i ich src). */
const BASES = ['', 'apps/server', 'apps/web', 'apps/server/src', 'apps/web/src'];

const dirOf = (path: string) => path.split('/').slice(0, -1).join('/');
const join = (base: string, path: string) => (base === '' ? path : `${base}/${path}`);

/** Skille projektowe = pierwsza kolumna tabeli w sekcji "Skille projektowe" w .agents/README.md. */
export function projectSkills(agentsReadme: string): string[] {
  const section = agentsReadme.split(/^## /m).find((s) => s.startsWith('Skille projektowe')) ?? '';

  return [...section.matchAll(/^\|\s*`([\w-]+)`/gm)].map((m) => m[1] ?? '');
}

export interface CheckDocsOptions {
  /** identyfikatory regul architecture-check, ktore AGENTS.md musi opisac */
  ruleIds: readonly string[];
}

export function documentsToCheck(fs: RepoFs): string[] {
  const skills = projectSkills(fs.read('.agents/README.md')).map((name) => `.agents/skills/${name}/SKILL.md`);

  return [
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    '.agents/README.md',
    ...['apps/server/AGENTS.md', 'apps/web/AGENTS.md'].filter((p) => fs.exists(p)),
    ...skills.filter((p) => fs.exists(p)),
  ];
}

export function checkDocs(fs: RepoFs, options: CheckDocsOptions): DocProblem[] {
  const problems: DocProblem[] = [];
  const rootScripts = fs.scripts('');

  for (const file of documentsToCheck(fs)) {
    const text = fs.read(file);
    const appDir = /^apps\/[^/]+/.exec(file)?.[0];
    const scripts = new Set([...rootScripts, ...(appDir ? fs.scripts(appDir) : [])]);

    for (const ref of extractPaths(text)) {
      if (IGNORED_PREFIXES.some((p) => ref.value === p || ref.value.startsWith(`${p}/`))) continue;
      const found = [dirOf(file), ...BASES].some((base) => fs.exists(join(base, ref.value)));

      if (!found) problems.push({ file, line: ref.line, message: `sciezka \`${ref.value}\` nie istnieje` });
    }

    for (const ref of extractBunScripts(text)) {
      if (!scripts.has(ref.value)) {
        problems.push({
          file,
          line: ref.line,
          message: `skrypt \`bun ${ref.value}\` nie istnieje w package.json`,
        });
      }
    }

    // `bun test` / `bun build` przy skrypcie o tej nazwie: Bun uruchamia wlasna komende, nie skrypt (turbo)
    for (const ref of extractBuiltinCalls(text)) {
      if (scripts.has(ref.value)) {
        problems.push({
          file,
          line: ref.line,
          message: `\`bun ${ref.value}\` uruchamia wbudowana komende Buna, nie skrypt z package.json - napisz \`bun run ${ref.value}\``,
        });
      }
    }

    for (const ref of extractSkills(text)) {
      if (!fs.exists(`.agents/skills/${ref.value}/SKILL.md`)) {
        problems.push({
          file,
          line: ref.line,
          message: `skill \`${ref.value}\` nie istnieje w .agents/skills`,
        });
      }
    }
  }

  for (const name of projectSkills(fs.read('.agents/README.md'))) {
    if (!fs.exists(`.agents/skills/${name}/SKILL.md`)) {
      problems.push({
        file: '.agents/README.md',
        line: 0,
        message: `skill projektowy \`${name}\` nie istnieje`,
      });
    }
  }

  const agents = fs.read('AGENTS.md');

  for (const id of options.ruleIds) {
    if (!agents.includes(`\`${id}\``)) {
      problems.push({
        file: 'AGENTS.md',
        line: 0,
        message: `regula architecture-check \`${id}\` nie jest opisana`,
      });
    }
  }

  return problems;
}
