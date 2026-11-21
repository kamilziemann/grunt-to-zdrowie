// Ekstraktor importow: wszystkie skladnie, type-only, komentarze/stringi/regexy/JSX, dyrektywa 'use client'.
import { describe, expect, it } from 'vitest';

import { extractImports } from '../src/imports';
import type { ImportRecord } from '../src/types';

const brief = (records: readonly ImportRecord[]): string[] =>
  records.map((r) => `${r.line}:${r.kind}${r.typeOnly ? ':type' : ''} ${r.specifier}`);

describe('extractImports', () => {
  it('rozpoznaje wszystkie formy importu statycznego', () => {
    const source = [
      "import x from 'a';",
      "import { a, b as c } from 'b';",
      "import * as ns from 'c';",
      "import def, { d } from 'd';",
      "import def2, * as ns2 from 'e';",
      "import 'side-effect';",
      'import {',
      '  multi,',
      '  line,',
      "} from 'f';",
      'import json from "g" with { type: "json" };',
    ].join('\n');

    expect(brief(extractImports(source).imports)).toEqual([
      '1:static a',
      '2:static b',
      '3:static c',
      '4:static d',
      '5:static e',
      '6:static side-effect',
      '7:static f',
      '11:static g',
    ]);
  });

  it('odroznia import type od importu mieszanego', () => {
    const source = [
      "import type { A } from 'a';",
      "import type B from 'b';",
      "import type * as C from 'c';",
      "import { type D, e } from 'd';",
      "import { type F } from 'f';",
      "import type from 'g';",
      "import type, { h } from 'h';",
    ].join('\n');

    expect(brief(extractImports(source).imports)).toEqual([
      '1:static:type a',
      '2:static:type b',
      '3:static:type c',
      '4:static d',
      '5:static f',
      '6:static g',
      '7:static h',
    ]);
  });

  it('rozpoznaje re-eksporty', () => {
    const source = [
      "export * from 'a';",
      "export * as ns from 'b';",
      "export { x, y as z } from 'c';",
      "export type { T } from 'd';",
      "export type * from 'e';",
      "export type * as NS from 'f';",
      'export { local };',
      'export type Local = string;',
      'export const value = 1;',
      'export default function fn() {}',
    ].join('\n');

    expect(brief(extractImports(source).imports)).toEqual([
      '1:reexport a',
      '2:reexport b',
      '3:reexport c',
      '4:reexport:type d',
      '5:reexport:type e',
      '6:reexport:type f',
    ]);
  });

  it('rozpoznaje import() i require()', () => {
    const source = [
      "const a = await import('a');",
      'const b = import("b").then((m) => m);',
      'const c = await import(`c`);',
      'const d = await import(`d/${name}`);',
      "const e = require('e');",
      'const f = import(variable);',
      "const g = import ( 'g' );",
      'const meta = import.meta.url;',
      "const h = require.resolve('h');",
    ].join('\n');

    expect(brief(extractImports(source).imports)).toEqual([
      '1:dynamic a',
      '2:dynamic b',
      '3:dynamic c',
      '5:require e',
      '7:dynamic g',
    ]);
  });

  it('ignoruje importy w komentarzach i stringach, zachowujac numery linii', () => {
    const source = [
      "// import fake from 'comment-line';",
      '/* import fake from "comment-block";',
      "   import { x } from 'still-comment'; */",
      'const s = "import x from \'in-string\'";',
      "const t = `import y from 'in-template' ${'x'}`;",
      "import real from 'real';",
      "const u = 'unterminated apostrophe wont break",
      "import after from 'after';",
    ].join('\n');

    expect(brief(extractImports(source).imports)).toEqual(['6:static real', '8:static after']);
  });

  it('nie myli sie na regexach i tekscie JSX z apostrofami', () => {
    const source = [
      'const re = /https?:\\/\\/[^/]+\\/*/g;',
      'const division = total / count / 2;',
      "import a from 'a';",
      'export function C() {',
      '  return <p className="x">Don\'t stop, it\'s fine</p>;',
      '}',
      "import b from 'b';",
      'const re2 = /[/*]/;',
      "import c from 'c';",
    ].join('\n');

    expect(brief(extractImports(source).imports)).toEqual(['3:static a', '7:static b', '9:static c']);
  });

  it('wykrywa dyrektywe use client tylko w prologu pliku', () => {
    expect(extractImports("'use client';\nimport a from 'a';").useClient).toBe(true);
    expect(extractImports('"use client"\nexport const x = 1;').useClient).toBe(true);
    expect(extractImports("// komentarz\n'use strict';\n'use client';\n").useClient).toBe(true);
    expect(extractImports("import a from 'a';\n'use client';").useClient).toBe(false);
    expect(extractImports("export const directive = 'use client';").useClient).toBe(false);
    expect(extractImports('').useClient).toBe(false);
  });

  it('numeruje linie poprawnie po wieloliniowych komentarzach i template stringach', () => {
    const source = ['/*', ' * licencja', ' */', 'const t = `', 'linia', '`;', "import x from 'x';"].join(
      '\n',
    );

    expect(brief(extractImports(source).imports)).toEqual(['7:static x']);
  });

  it('obsluguje import x = require() jako require', () => {
    expect(brief(extractImports("import fs = require('node:fs');").imports)).toEqual(['1:require node:fs']);
  });
});
