// CLI: `bun run docs:check` (root). Kod wyjscia 1 przy problemach; format `plik:linia komunikat`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';

import { RULE_IDS } from '@app/architecture-check';

import { checkDocs, type RepoFs } from '../check-docs';

const { values } = parseArgs({ options: { root: { type: 'string', default: '.' } } });
const root = values.root ?? '.';

function walkMarkdown(dir: string): string[] {
  const abs = join(root, dir);

  if (!existsSync(abs)) return [];

  return readdirSync(abs).flatMap((entry) => {
    const rel = `${dir}/${entry}`;

    if (statSync(join(root, rel)).isDirectory()) return walkMarkdown(rel);

    return entry.endsWith('.md') ? [rel] : [];
  });
}

const fs: RepoFs = {
  exists: (path) => existsSync(join(root, path)),
  read: (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : ''),
  markdownUnder: walkMarkdown,
  scripts: (dir) => {
    const file = join(root, dir, 'package.json');

    if (!existsSync(file)) return [];
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const scripts =
      typeof parsed === 'object' && parsed !== null && 'scripts' in parsed ? parsed.scripts : undefined;

    return typeof scripts === 'object' && scripts !== null ? Object.keys(scripts) : [];
  },
};

const problems = checkDocs(fs, { ruleIds: RULE_IDS });

for (const p of problems) console.error(`${p.file}:${p.line} ${p.message}`);

if (problems.length > 0) {
  console.error(
    `\nDokumentacja rozjechala sie z repo (${problems.length}). Popraw dokument albo kod w tej samej zmianie.`,
  );
  process.exit(1);
}

console.log(`OK: dokumentacja zgodna z repo (${relative(process.cwd(), root) || '.'}).`);
