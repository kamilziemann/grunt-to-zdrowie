// Wyciaganie odwolan z Markdown: sciezki w `backtickach`, komendy `bun ...`, nazwy skilli ("skill `x`").
// Czyste funkcje na tekscie - bez dysku, zeby testy byly proste.

export interface Ref {
  value: string;
  line: number;
}

// Tylko odwolania ze sciezka (z `/`) albo pliki konfiguracyjne roota; same nazwy plikow (`ports.ts`) to przyklady
// nazewnictwa, nie odwolania.
const PATH_ROOTS = /^(apps|packages|tools|docs|\.agents|\.claude|\.github|src|test|e2e|scripts|messages)\//;
const ROOT_FILE =
  /^[\w-]+\.config\.ts$|^(AGENTS|CLAUDE|README)\.md$|^(package|turbo|tsconfig|skills-lock)\.json$/;
const PLACEHOLDER = /[<>*{}…\s:|$]|\.\.\./;

/** Spany `kod` w linii (bez blokow ```). */
function codeSpans(line: string): string[] {
  return [...line.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '');
}

function eachLine(markdown: string, visit: (line: string, index: number) => void): void {
  let fenced = false;

  markdown.split('\n').forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;

      return;
    }

    if (!fenced) visit(line, index + 1);
  });
}

/** Sciezki repo wymienione w tekscie (pomija szablony z <nazwa>, globy i adresy). */
export function extractPaths(markdown: string): Ref[] {
  const refs: Ref[] = [];

  eachLine(markdown, (line, lineNo) => {
    for (const span of codeSpans(line)) {
      const value = span.replace(/:\d+$/, '').replace(/\/$/, '');

      if (PLACEHOLDER.test(value) || value.startsWith('@') || value.includes('://')) continue;

      if (PATH_ROOTS.test(value) || (ROOT_FILE.test(value) && !value.startsWith('.')))
        refs.push({ value, line: lineNo });
    }
  });

  return refs;
}

/**
 * Wbudowane komendy Buna. `bun <nazwa>` uruchamia komende, nawet gdy package.json ma skrypt o tej nazwie
 * (`bun test` = runner testow Buna, `bun build` = bundler) - skrypt wolamy wtedy przez `bun run <nazwa>`.
 */
export const BUN_BUILTINS: ReadonlySet<string> = new Set([
  'add',
  'audit',
  'build',
  'create',
  'exec',
  'info',
  'init',
  'install',
  'link',
  'outdated',
  'patch',
  'pm',
  'publish',
  'remove',
  'repl',
  'run',
  'test',
  'unlink',
  'update',
  'upgrade',
  'why',
  'x',
]);

/** Skrypty z `bun <skrypt>` / `bun run <skrypt>` w spanach i blokach kodu (pomija wbudowane komendy Buna). */
export function extractBunScripts(markdown: string): Ref[] {
  const refs: Ref[] = [];

  markdown.split('\n').forEach((line, index) => {
    // `bun run --cwd apps/web test` / `--filter` = skrypt innej paczki - poza zakresem tej reguly
    for (const m of line.matchAll(
      /(?:^|[`\s(])bun (run )?(--(?:cwd|filter)[ =]\S+ )?([a-z][\w:-]*)(?![\w/.])/g,
    )) {
      const name = m[3] ?? '';

      if (!m[2] && (m[1] || !BUN_BUILTINS.has(name))) refs.push({ value: name, line: index + 1 });
    }
  });

  return refs;
}

/**
 * Wbudowane komendy Buna wywolane bez argumentow (`bun test`, `bun build`). Gdy package.json ma skrypt o tej nazwie,
 * dokument niemal na pewno mial na mysli skrypt (`bun run test`), a czytelnik dostanie runner albo bundler Buna.
 * Wywolania z argumentem (`bun test ./tools/scripts`, `bun x ...`) to swiadome uzycie komendy.
 */
export function extractBuiltinCalls(markdown: string): Ref[] {
  const refs: Ref[] = [];

  markdown.split('\n').forEach((line, index) => {
    for (const m of line.matchAll(/(?:^|[`\s(])bun ([a-z][\w:-]*)(?=\s*(?:$|[`),;&|#]))/g)) {
      const name = m[1] ?? '';

      if (BUN_BUILTINS.has(name)) refs.push({ value: name, line: index + 1 });
    }
  });

  return refs;
}

/** Nazwy skilli z fraz "skill `x`", "skille `x`, `y`" i "skillem `x`". */
export function extractSkills(markdown: string): Ref[] {
  const refs: Ref[] = [];

  eachLine(markdown, (line, lineNo) => {
    for (const m of line.matchAll(/skill(?:e|em|a|u)?\s+((?:`[\w-]+`(?:,\s*|\s+i\s+)?)+)/gi)) {
      for (const name of codeSpans(m[1] ?? '')) refs.push({ value: name, line: lineNo });
    }
  });

  return refs;
}
