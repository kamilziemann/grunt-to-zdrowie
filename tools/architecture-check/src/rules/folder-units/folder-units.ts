// folder-units: w skonfigurowanych katalogach (`folderUnits.dirs`) kazda jednostka - funkcja, komponent, modul - ma wlasny
// folder <katalog>/<nazwa>/ z plikiem glownym, testami, pomocnikami i index.ts (publiczne API). Dwa naruszenia:
// 1. plik zrodlowy (takze test) lezy bezposrednio w takim katalogu (poza `allowRootFiles`),
// 2. import spoza folderu jednostki siega do jej prywatnego pliku zamiast do folderu (index.ts).
// Katalog z listy, ktory sam lezy w katalogu z listy (np. lib/utils w lib), jest grupa: nie jest jednostka, a jego
// podfoldery sa. Podkatalogi z `ignore` (np. dane generowane) oraz foldery `__x__` (np. __snapshots__) nie sa jednostkami.
import { readdirSync } from 'node:fs';

import type { FolderUnitRules } from '../../config';
import { matchesAny, scanDirs } from '../../glob';
import { basenamePosix, dirnamePosix, extnamePosix } from '../../paths';
import type { Rule, RuleContext, Violation } from '../../types';
import { violation } from '../helpers';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/** Nazwa jednostki dla pliku: `foo.ts`, `foo.test.tsx`, `foo.d.ts` -> `foo`. */
function unitStem(fileName: string): string {
  const withoutExtension = fileName.slice(0, fileName.length - extnamePosix(fileName).length);

  return withoutExtension.replace(/\.(?:test|spec|d)$/, '');
}

/** Pliki zrodlowe lezace bezposrednio w katalogach z `dirs` (czyta dysk, wiec lapie tez testy poza skanem). */
function looseFiles(ctx: RuleContext, rules: FolderUnitRules): Violation[] {
  const out: Violation[] = [];

  for (const dir of scanDirs(ctx.root, rules.dirs)) {
    for (const entry of readdirSync(`${ctx.root}/${dir}`, { withFileTypes: true })) {
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extnamePosix(entry.name))) continue;
      if (rules.allowRootFiles.includes(entry.name)) continue;
      const stem = unitStem(entry.name);
      const target = `${dir}/${stem}/${entry.name}`;

      out.push(
        violation(
          'folder-units',
          `${dir}/${entry.name}`,
          0,
          `Plik ${entry.name} lezy bezposrednio w ${dir}. Kazda jednostka ma wlasny folder: przenies go do ${target} (publiczne API w ${dir}/${stem}/index.ts).`,
        ),
      );
    }
  }

  return out;
}

/** Foldery jednostek, w ktorych lezy `path` (od zewnetrznego do wewnetrznego); zwykle jeden. */
function unitFoldersOf(path: string, rules: FolderUnitRules, cache: Map<string, boolean>): string[] {
  const segments = path.split('/');
  const folders: string[] = [];

  for (let depth = 2; depth < segments.length; depth++) {
    const folder = segments.slice(0, depth).join('/');
    let isUnit = cache.get(folder);

    if (isUnit === undefined) {
      const name = basenamePosix(folder);

      isUnit =
        matchesAny(rules.dirs, dirnamePosix(folder)) &&
        !matchesAny(rules.dirs, folder) &&
        !matchesAny(rules.ignore ?? [], folder) &&
        !(name.startsWith('__') && name.endsWith('__'));
      cache.set(folder, isUnit);
    }

    if (isUnit) folders.push(folder);
  }

  return folders;
}

const isPublicEntry = (path: string): boolean => /^index\.[cm]?[jt]sx?$/.test(basenamePosix(path));

/** Importy spoza folderu jednostki, ktore wskazuja na jej plik inny niz index.* (prywatny). */
function privateImports(ctx: RuleContext, rules: FolderUnitRules): Violation[] {
  const out: Violation[] = [];
  const cache = new Map<string, boolean>();

  for (const file of ctx.files) {
    for (const imp of file.imports) {
      const target = imp.resolved.path;

      if (imp.resolved.kind !== 'file' || target === null) continue;

      for (const folder of unitFoldersOf(target, rules, cache)) {
        if (file.path.startsWith(`${folder}/`)) continue;
        if (target === `${folder}/${basenamePosix(target)}` && isPublicEntry(target)) continue;

        out.push(
          violation(
            'folder-units',
            file.path,
            imp.line,
            `Import prywatnego pliku jednostki ${folder} ('${imp.specifier}'). Importuj folder jednostki (${folder}, czyli jej index.ts), nie pliki w srodku.`,
          ),
        );
        break;
      }
    }
  }

  return out;
}

export const folderUnits: Rule = {
  id: 'folder-units',
  description: 'Jednostka (funkcja, komponent, modul) ma wlasny folder; import tylko przez jego index.ts.',
  run(ctx) {
    const rules = ctx.config.folderUnits;

    if (!rules) return [];

    return [...looseFiles(ctx, rules), ...privateImports(ctx, rules)];
  },
};
