import { PROBLEM_CODES } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { FULL_CATALOG } from './full-catalog';
import { NAMESPACES } from './namespaces';

const { pl, en } = FULL_CATALOG;

type Tree = { [key: string]: string | Tree };

/** Splaszcza drzewo komunikatow do par `sciezka.klucz` -> tekst. */
function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') out[path] = value;
    else flatten(value, path, out);
  }

  return out;
}

/** Nazwy argumentow ICU ({max}, {date}) posortowane: oba jezyki musza ich uzywac tak samo. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').toSorted();
}

const plFlat = flatten(pl);
const enFlat = flatten(en);

describe('komunikaty i18n', () => {
  it('kazdy plik messages/<jezyk>/*.json jest na liscie NAMESPACES (i odwrotnie)', () => {
    for (const locale of ['pl', 'en']) {
      const files = readdirSync(join(import.meta.dirname, '../../messages', locale))
        .map((name) => name.replace(/\.json$/, ''))
        .toSorted();

      expect([locale, files]).toEqual([locale, [...NAMESPACES].toSorted()]);
    }
  });

  it('pl i en mają identyczne zestawy kluczy', () => {
    expect(Object.keys(enFlat).toSorted()).toEqual(Object.keys(plFlat).toSorted());
  });

  it('żaden komunikat nie jest pusty', () => {
    for (const [key, text] of [...Object.entries(plFlat), ...Object.entries(enFlat)]) {
      expect([key, text.trim().length > 0]).toEqual([key, true]);
    }
  });

  it('pl i en używają tych samych argumentów ICU', () => {
    for (const [key, text] of Object.entries(plFlat)) {
      expect([key, placeholders(enFlat[key] ?? '')]).toEqual([key, placeholders(text)]);
    }
  });

  it('każdy kod Problem Details ma komunikat w obu językach', () => {
    for (const code of Object.values(PROBLEM_CODES)) {
      expect(pl.problems).toHaveProperty(code);
      expect(en.problems).toHaveProperty(code);
    }
  });
});
