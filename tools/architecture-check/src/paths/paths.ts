// Operacje na sciezkach POSIX (wzglednych do roota). Nie uzywamy node:path, zeby na Windows nie mieszac separatorow.

export function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

/** Normalizuje `./` i `../`, usuwa podwojne i koncowe `/`. Sciezka wychodzaca ponad root zaczyna sie od `../`. */
export function normalizePosix(path: string): string {
  const out: string[] = [];

  for (const part of toPosix(path).split('/')) {
    if (part === '' || part === '.') continue;

    if (part === '..') {
      const last = out.at(-1);

      if (last !== undefined && last !== '..') out.pop();
      else out.push('..');

      continue;
    }

    out.push(part);
  }

  return out.join('/');
}

export function joinPosix(...parts: string[]): string {
  return normalizePosix(parts.filter((p) => p !== '').join('/'));
}

export function dirnamePosix(path: string): string {
  const i = path.lastIndexOf('/');

  return i === -1 ? '' : path.slice(0, i);
}

export function basenamePosix(path: string): string {
  const i = path.lastIndexOf('/');

  return i === -1 ? path : path.slice(i + 1);
}

/** Rozszerzenie z kropka ('.ts') albo '' gdy brak. */
export function extnamePosix(path: string): string {
  const base = basenamePosix(path);
  const i = base.lastIndexOf('.');

  return i <= 0 ? '' : base.slice(i);
}

/** Czy `path` lezy w katalogu `dir` (lub jest nim). Pusty `dir` = root, zawiera wszystko. */
export function isWithin(dir: string, path: string): boolean {
  if (dir === '') return true;

  return path === dir || path.startsWith(`${dir}/`);
}

/** Sciezka `path` wzgledem katalogu `dir` (zaklada isWithin). */
export function relativeTo(dir: string, path: string): string {
  if (dir === '') return path;
  if (path === dir) return '';

  return path.slice(dir.length + 1);
}

/** Pierwszy segment sciezki wzglednej (`a/b/c` -> `a`), null gdy sciezka nie ma katalogu. */
export function firstSegment(relative: string): string | null {
  const i = relative.indexOf('/');

  return i === -1 ? null : relative.slice(0, i);
}
