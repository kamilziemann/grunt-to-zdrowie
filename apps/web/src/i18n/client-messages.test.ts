import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PUBLIC_NAMESPACES, SECTION_NAMESPACES, type ClientSection } from './client-messages';
import { NAMESPACES } from './namespaces';

const SRC = join(import.meta.dirname, '..');

/** Gdzie zyja komponenty pod dostawca danej sekcji (jej layout). */
const SECTION_DIRS: Record<ClientSection, readonly string[]> = {
  method: ['routes/{-$locale}/_app/_method/'],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Przestrzenie, po ktore plik siega hookiem (klient albo synchroniczny serwer): useTranslations('x') i t('x.') przy useTranslations(). */
function hookNamespaces(source: string): string[] {
  const named = [...source.matchAll(/useTranslations\(\s*['"]([A-Za-z]+)/g)].map((match) => match[1] ?? '');
  const root = /useTranslations\(\s*\)/.test(source)
    ? [...source.matchAll(/\bt\(\s*['"]([A-Za-z]+)\./g)].map((match) => match[1] ?? '')
    : [];

  return [...named, ...root];
}

describe('komunikaty w przegladarce', () => {
  it('zwykle strony nie dostaja przestrzeni sekcji deweloperskiej, sekcja ma swoje', () => {
    const sectionOnly = Object.values(SECTION_NAMESPACES).flat() as string[];

    expect([...PUBLIC_NAMESPACES].toSorted()).toEqual(
      NAMESPACES.filter((namespace) => !sectionOnly.includes(namespace)).toSorted(),
    );
    expect(SECTION_NAMESPACES.method).toEqual(expect.arrayContaining(['method']));
  });

  it('przestrzenie sekcji uzywaja hookiem tylko pliki pod dostawca tej sekcji', () => {
    const misplaced: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const path = relative(SRC, file).split(sep).join('/');

      for (const namespace of hookNamespaces(readFileSync(file, 'utf8'))) {
        const section = (Object.keys(SECTION_NAMESPACES) as ClientSection[]).find((key) =>
          (SECTION_NAMESPACES[key] as readonly string[]).includes(namespace),
        );

        if (section && !SECTION_DIRS[section].some((dir) => path.startsWith(dir))) {
          misplaced.push(`${path}: ${namespace}`);
        }
      }
    }

    expect(misplaced).toEqual([]);
  });
});
