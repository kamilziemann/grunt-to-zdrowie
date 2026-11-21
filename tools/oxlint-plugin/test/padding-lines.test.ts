// Testy reguly arch/padding-lines (puste linie w listach instrukcji + autofix) przez RuleTester z `oxlint/plugins-dev`.
// `output` to kod po jednym przejsciu autofixu (wszystkie nienakladajace sie poprawki naraz).
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../src/index.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();
const TS_FILE = 'C:/dev/app/apps/server/src/lib/sample.ts';
const TSX_FILE = 'C:/dev/app/apps/web/src/components/sample.tsx';

/** Sklada kod z linii (czytelniejsze niz literaly z wcieciami). */
const lines = (...rows: string[]): string => rows.join('\n');

const rule = plugin.rules['padding-lines'];
const beforeReturn = { message: /przed 'return'/ };
const beforeThrow = { message: /przed 'throw'/ };
const afterVariables = { message: /po deklaracjach zmiennych/ };
const afterBlock = { message: /po wieloliniowym bloku/ };
const beforeBlock = { message: /przed wieloliniowym blokiem/ };

// Wieloliniowe instrukcje blokowe: kazda musi byc oddzielona od sasiadow (przed i po).
const BLOCKS: Record<string, string[]> = {
  if: ['if (a) {', '  run();', '}'],
  'if-else': ['if (a) {', '  run();', '} else if (b) {', '  other();', '} else {', '  last();', '}'],
  for: ['for (let i = 0; i < 3; i++) {', '  run(i);', '}'],
  'for-in': ['for (const k in o) {', '  run(k);', '}'],
  'for-of': ['for (const v of list) {', '  run(v);', '}'],
  while: ['while (a) {', '  run();', '}'],
  'do-while': ['do {', '  run();', '} while (a);'],
  switch: ['switch (a) {', '  case 1:', '    run();', '    break;', '}'],
  try: ['try {', '  run();', '} catch {', '  other();', '}'],
  labeled: ['outer: for (const v of list) {', '  continue outer;', '}'],
  block: ['{', '  run();', '}'],
  function: ['function helper() {', '  run();', '}'],
  'async-function': ['async function helper() {', '  await run();', '}'],
  class: ['class Helper {', '  run() {}', '}'],
  'export-function': ['export function helper() {', '  run();', '}'],
  'export-default-function': ['export default function () {', '  run();', '}'],
  interface: ['interface Shape {', '  size: number;', '}'],
  'type-alias': ['type Shape =', "  | 'a'", "  | 'b';"],
  enum: ['enum Mode {', '  A,', '  B,', '}'],
  namespace: ['namespace Util {', '  export const x = 1;', '}'],
};

tester.run('padding-lines', rule, {
  valid: [
    // return/throw jako pierwsza instrukcja bloku
    { filename: TS_FILE, code: lines('function f() {', '  return 1;', '}') },
    { filename: TS_FILE, code: lines('function f() {', "  throw new Error('x');", '}') },
    { filename: TS_FILE, code: lines('function f() {', '  // wynik', '  return 1;', '}') },
    { filename: TS_FILE, code: lines('const f = () => {', '  return 1;', '};') },
    // pusta linia przed return/throw
    { filename: TS_FILE, code: lines('function f(a) {', '  const x = a;', '', '  return x;', '}') },
    { filename: TS_FILE, code: lines('function f(a) {', '  run(a);', '', "  throw new Error('x');", '}') },
    // pusta linia przed komentarzem prowadzacym albo miedzy komentarzem a instrukcja
    { filename: TS_FILE, code: lines('function f(a) {', '  run(a);', '', '  // wynik', '  return a;', '}') },
    { filename: TS_FILE, code: lines('function f(a) {', '  run(a);', '  // wynik', '', '  return a;', '}') },
    // seria deklaracji zmiennych, potem pusta linia
    { filename: TS_FILE, code: lines('const a = 1;', 'let b = 2;', 'var c = 3;', '', 'run(a, b, c);') },
    {
      filename: TS_FILE,
      code: lines('export const a = 1;', 'export const b = 2;', 'const c = 3;', '', 'run(c);'),
    },
    { filename: TS_FILE, code: lines('const a = {', '  x: 1,', '};', 'const b = [', '  1,', '];') },
    { filename: TS_FILE, code: 'const a = 1;' },
    // instrukcje jednoliniowe nie wymagaja odstepow miedzy soba
    {
      filename: TS_FILE,
      code: lines(
        'function f(a, b) {',
        '  if (!a) return;',
        '  if (!b) return;',
        '  run(a);',
        '  run(b);',
        '}',
      ),
    },
    {
      filename: TS_FILE,
      code: lines('function f(a) {', '  run(a);', '  if (a) run(1);', '  other(a);', '}'),
    },
    { filename: TS_FILE, code: lines('function f() {}', 'function g() {}') },
    // wieloliniowy blok jako pierwsza/ostatnia instrukcja w bloku
    { filename: TS_FILE, code: lines('function f(a) {', '  if (a) {', '    run();', '  }', '}') },
    {
      filename: TS_FILE,
      code: lines('function f(a) {', '  run();', '', '  if (a) {', '    run();', '  }', '}'),
    },
    // wieloliniowe bloki oddzielone pustymi liniami
    {
      filename: TS_FILE,
      code: lines('if (a) {', '  run();', '}', '', 'run();', '', 'if (b) {', '  run();', '}'),
    },
    // lancuch if / else if / else to jedna instrukcja
    {
      filename: TS_FILE,
      code: lines(
        'if (a) {',
        '  run();',
        '} else if (b) {',
        '  other();',
        '} else {',
        '  last();',
        '}',
        '',
        'run();',
      ),
    },
    // switch: instrukcje w case sa listami; same case'y nie wymagaja odstepow
    {
      filename: TS_FILE,
      code: lines(
        'switch (k) {',
        "  case 'a':",
        '    return 1;',
        "  case 'b': {",
        '    const x = 1;',
        '',
        '    return x;',
        '  }',
        '  default:',
        "    throw new Error('x');",
        '}',
      ),
    },
    // wyrazenia (obiekty, tablice, funkcje strzalkowe w argumentach) nie sa listami instrukcji
    {
      filename: TS_FILE,
      code: lines('const o = {', '  a: 1,', '  b: () => 1,', '  c: [', '    1,', '    2,', '  ],', '};'),
    },
    { filename: TS_FILE, code: lines('run(', '  () => 1,', '  () => 2,', ');', 'run(2);') },
    // dyrektywy zostaja na poczatku
    { filename: TSX_FILE, code: lines("'use client';", "import { a } from 'a';", '', 'export const b = a;') },
    { filename: TS_FILE, code: lines("'use strict';", 'if (a) {', '  run();', '}') },
    // przeciazenia funkcji to jedna calosc
    {
      filename: TS_FILE,
      code: lines(
        'export function f(a: string): string;',
        'export function f(a: number): number;',
        'export function f(a: string | number) {',
        '  return a;',
        '}',
      ),
    },
    // puste instrukcje sa pomijane
    { filename: TS_FILE, code: lines('run();', ';', 'run();') },
    // static block i namespace
    {
      filename: TS_FILE,
      code: lines('class A {', '  static {', '    run();', '', '    other();', '  }', '}'),
    },
    {
      filename: TS_FILE,
      code: lines('namespace N {', '  export const a = 1;', '  export const b = 2;', '}'),
    },
    // TSX
    {
      filename: TSX_FILE,
      code: lines(
        'export function C({ items }: Props) {',
        '  const [a, setA] = useState(0);',
        '',
        '  useEffect(() => {',
        '    setA(1);',
        '  }, []);',
        '',
        '  return <div>{items.map((i) => <b key={i}>{i}</b>)}</div>;',
        '}',
      ),
    },
  ],
  invalid: [
    // return i throw
    {
      filename: TS_FILE,
      code: lines('function f() {', '  run();', '  return 1;', '}'),
      output: lines('function f() {', '  run();', '', '  return 1;', '}'),
      errors: [{ ...beforeReturn, line: 3, column: 2 }],
    },
    {
      filename: TS_FILE,
      code: lines('function f() {', '  run();', "  throw new Error('x');", '}'),
      output: lines('function f() {', '  run();', '', "  throw new Error('x');", '}'),
      errors: [beforeThrow],
    },
    // po serii deklaracji zmiennych
    {
      filename: TS_FILE,
      code: lines('const a = 1;', 'const b = 2;', 'run(a, b);'),
      output: lines('const a = 1;', 'const b = 2;', '', 'run(a, b);'),
      errors: [{ ...afterVariables, line: 3 }],
    },
    {
      filename: TS_FILE,
      code: lines('export const a = 1;', 'export function f() {', '  return a;', '}'),
      output: lines('export const a = 1;', '', 'export function f() {', '  return a;', '}'),
      errors: [afterVariables],
    },
    {
      filename: TS_FILE,
      code: lines('export const a = 1;', 'export type A = typeof a;'),
      output: lines('export const a = 1;', '', 'export type A = typeof a;'),
      errors: [afterVariables],
    },
    {
      filename: TS_FILE,
      code: lines('function f(a) {', '  let x = a;', '  if (!x) return;', '}'),
      output: lines('function f(a) {', '  let x = a;', '', '  if (!x) return;', '}'),
      errors: [afterVariables],
    },
    // return po wieloliniowym bloku to jeden blad (zglaszany jako 'return')
    {
      filename: TS_FILE,
      code: lines('function f(a) {', '  if (a) {', '    run();', '  }', '  return a;', '}'),
      output: lines('function f(a) {', '  if (a) {', '    run();', '  }', '', '  return a;', '}'),
      errors: [beforeReturn],
    },
    // wieloliniowy blok po zwyklej instrukcji i przed nia
    {
      filename: TS_FILE,
      code: lines('run();', 'if (a) {', '  other();', '}'),
      output: lines('run();', '', 'if (a) {', '  other();', '}'),
      errors: [{ ...beforeBlock, line: 2, column: 0 }],
    },
    {
      filename: TS_FILE,
      code: lines('if (a) {', '  other();', '}', 'run();'),
      output: lines('if (a) {', '  other();', '}', '', 'run();'),
      errors: [afterBlock],
    },
    {
      filename: TS_FILE,
      code: lines('run();', 'if (a) {', '  other();', '}', 'run();'),
      output: lines('run();', '', 'if (a) {', '  other();', '}', '', 'run();'),
      errors: [beforeBlock, afterBlock],
    },
    // dwa wieloliniowe bloki obok siebie
    {
      filename: TS_FILE,
      code: lines('if (a) {', '  run();', '}', 'if (b) {', '  run();', '}'),
      output: lines('if (a) {', '  run();', '}', '', 'if (b) {', '  run();', '}'),
      errors: [afterBlock],
    },
    // jednoliniowy `if` obok wieloliniowego
    {
      filename: TS_FILE,
      code: lines('function f(a) {', '  if (!a) return;', '  if (a > 1) {', '    run();', '  }', '}'),
      output: lines('function f(a) {', '  if (!a) return;', '', '  if (a > 1) {', '    run();', '  }', '}'),
      errors: [beforeBlock],
    },
    // pusta linia idzie PRZED komentarzem prowadzacym instrukcje
    {
      filename: TS_FILE,
      code: lines('function f(a) {', '  run(a);', '  // wynik', '  return a;', '}'),
      output: lines('function f(a) {', '  run(a);', '', '  // wynik', '  return a;', '}'),
      errors: [beforeReturn],
    },
    {
      filename: TS_FILE,
      code: lines('run();', '/**', ' * Opis.', ' */', 'function helper() {', '  run();', '}'),
      output: lines('run();', '', '/**', ' * Opis.', ' */', 'function helper() {', '  run();', '}'),
      errors: [beforeBlock],
    },
    {
      filename: TS_FILE,
      code: lines('run();', '// pierwszy', '// drugi', 'if (a) {', '  other();', '}'),
      output: lines('run();', '', '// pierwszy', '// drugi', 'if (a) {', '  other();', '}'),
      errors: [beforeBlock],
    },
    // komentarz w tej samej linii co koniec poprzedniej instrukcji zostaje przy niej
    {
      filename: TS_FILE,
      code: lines('const a = 1; // koniec', '// dalej', 'run(a);'),
      output: lines('const a = 1; // koniec', '', '// dalej', 'run(a);'),
      errors: [afterVariables],
    },
    {
      filename: TS_FILE,
      code: lines('if (a) {', '  run();', '} // koniec', 'run();'),
      output: lines('if (a) {', '  run();', '} // koniec', '', 'run();'),
      errors: [afterBlock],
    },
    // dwie instrukcje w jednej linii
    {
      filename: TS_FILE,
      code: "run(); throw new Error('x');",
      output: lines('run();', '', "throw new Error('x');"),
      errors: [beforeThrow],
    },
    // zakonczenia linii CRLF zostaja zachowane
    {
      filename: TS_FILE,
      code: "run();\r\nthrow new Error('x');",
      output: "run();\r\n\r\nthrow new Error('x');",
      errors: [beforeThrow],
    },
    // switch: instrukcje w case
    {
      filename: TS_FILE,
      code: lines('switch (k) {', "  case 'a':", '    run();', '    return 1;', '}'),
      output: lines('switch (k) {', "  case 'a':", '    run();', '', '    return 1;', '}'),
      errors: [beforeReturn],
    },
    {
      filename: TS_FILE,
      code: lines('switch (k) {', "  case 'a':", '    const x = 1;', '    run(x);', '    break;', '}'),
      output: lines('switch (k) {', "  case 'a':", '    const x = 1;', '', '    run(x);', '    break;', '}'),
      errors: [afterVariables],
    },
    // zagniezdzone bloki: kazdy poziom osobno, wszystkie poprawki w jednym przejsciu
    {
      filename: TS_FILE,
      code: lines(
        'function f(list) {',
        '  const out = [];',
        '  for (const v of list) {',
        '    const x = v * 2;',
        '    if (x > 1) {',
        '      out.push(x);',
        '    }',
        '    out.push(v);',
        '  }',
        '  return out;',
        '}',
      ),
      output: lines(
        'function f(list) {',
        '  const out = [];',
        '',
        '  for (const v of list) {',
        '    const x = v * 2;',
        '',
        '    if (x > 1) {',
        '      out.push(x);',
        '    }',
        '',
        '    out.push(v);',
        '  }',
        '',
        '  return out;',
        '}',
      ),
      errors: [afterVariables, afterVariables, afterBlock, beforeReturn],
    },
    // static block i modul ambient
    {
      filename: TS_FILE,
      code: lines('class A {', '  static {', '    const a = 1;', '    run(a);', '  }', '}'),
      output: lines('class A {', '  static {', '    const a = 1;', '', '    run(a);', '  }', '}'),
      errors: [afterVariables],
    },
    {
      filename: TS_FILE,
      code: lines('declare module "m" {', '  const a: number;', '  function f(): void;', '}'),
      output: lines('declare module "m" {', '  const a: number;', '', '  function f(): void;', '}'),
      errors: [afterVariables],
    },
    // TSX
    {
      filename: TSX_FILE,
      code: lines('export function C() {', '  const [a] = useState(0);', '  return <div>{a}</div>;', '}'),
      output: lines(
        'export function C() {',
        '  const [a] = useState(0);',
        '',
        '  return <div>{a}</div>;',
        '}',
      ),
      errors: [beforeReturn],
    },
    // kazda instrukcja blokowa: odstep przed i po
    ...Object.entries(BLOCKS).map(([name, block]) => ({
      name: `blok: ${name}`,
      filename: TS_FILE,
      code: lines('run();', ...block, 'run();'),
      output: lines('run();', '', ...block, '', 'run();'),
      errors: [beforeBlock, afterBlock],
    })),
  ],
});
