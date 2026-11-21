// Dopasowanie sciezek do globow z konfiguracji (Bun.Glob, semantyka jak w .gitignore/minimatch: `**` = 0..n katalogow).
import { statSync } from 'node:fs';

const cache = new Map<string, Bun.Glob>();

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function globFor(pattern: string): Bun.Glob {
  let glob = cache.get(pattern);

  if (!glob) {
    glob = new Bun.Glob(pattern);
    cache.set(pattern, glob);
  }

  return glob;
}

export function matchGlob(pattern: string, path: string): boolean {
  return globFor(pattern).match(path);
}

export function matchesAny(patterns: readonly string[], path: string): boolean {
  return patterns.some((pattern) => matchGlob(pattern, path));
}

/** Istniejace katalogi pasujace do globow (wzgledem `root`). Zwraca sciezki POSIX. */
export function scanDirs(root: string, patterns: readonly string[]): string[] {
  const found = new Set<string>();

  for (const pattern of patterns) {
    for (const entry of globFor(pattern).scanSync({ cwd: root, onlyFiles: false, dot: false })) {
      const path = entry.replaceAll('\\', '/');

      if (isDirectory(`${root}/${path}`)) found.add(path);
    }
  }

  return [...found].toSorted();
}

/** Skanuje pliki pasujace do `include` (wzgledem `root`) i odrzuca pasujace do `exclude`. Zwraca sciezki POSIX. */
export function scanPaths(root: string, include: readonly string[], exclude: readonly string[]): string[] {
  const found = new Set<string>();

  for (const pattern of include) {
    for (const entry of globFor(pattern).scanSync({ cwd: root, onlyFiles: true, dot: false })) {
      const path = entry.replaceAll('\\', '/');

      if (!matchesAny(exclude, path)) found.add(path);
    }
  }

  return [...found].toSorted();
}
