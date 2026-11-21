// Ekstraktor importow bez pelnego parsera: lekki skaner leksykalny pomija komentarze, literaly tekstowe,
// template stringi i regexy (takze tekst JSX z apostrofami), a potem czyta deklaracje z listy tokenow.
// Rozpoznaje: import x/{a}/* as ns/type from, import 'x', import { type A, b } (NIE type-only przy
// verbatimModuleSyntax), export ... from, export type ... from, import('x'), require('x').
import type { ImportRecord } from '../types';

export interface ExtractedImports {
  imports: ImportRecord[];
  /** plik zaczyna sie od dyrektywy 'use client' */
  useClient: boolean;
}

type TokenType = 'ident' | 'string' | 'template' | 'punct' | 'other';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  /** string/template: tresc bez cudzyslowow; template z `${}` -> null */
  text: string | null;
}

const REGEX_AFTER_KEYWORD = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

const MAX_IMPORT_TOKENS = 4000;

const isIdentStart = (ch: string): boolean => /[A-Za-z_$]/.test(ch) || ch.charCodeAt(0) > 127;
const isIdentPart = (ch: string): boolean => /[\w$]/.test(ch) || ch.charCodeAt(0) > 127;
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

function countNewlines(text: string): number {
  let count = 0;

  for (const ch of text) if (ch === '\n') count++;

  return count;
}

function regexAllowedAfter(prev: Token | undefined): boolean {
  if (!prev) return true;
  if (prev.type === 'punct') return prev.value !== ')' && prev.value !== ']' && prev.value !== '}';
  if (prev.type === 'ident') return REGEX_AFTER_KEYWORD.has(prev.value);

  return false;
}

/** Koniec literalu regex zaczynajacego sie w `start` (indeks za flagami) albo -1, gdy to nie regex. */
function scanRegex(source: string, start: number): number {
  let j = start + 1;
  let inClass = false;

  while (j < source.length) {
    const ch = source.charAt(j);

    if (ch === '\\') {
      j += 2;
      continue;
    }

    if (ch === '\n') return -1;

    if (inClass) {
      if (ch === ']') inClass = false;
    } else if (ch === '[') {
      inClass = true;
    } else if (ch === '/') {
      j++;
      while (j < source.length && /[a-z]/i.test(source.charAt(j))) j++;

      return j;
    }

    j++;
  }

  return -1;
}

/** Koniec literalu tekstowego (indeks za cudzyslowem) albo -1, gdy niezamkniety w tej linii (np. apostrof w JSX). */
function scanString(source: string, start: number, quote: string): number {
  let j = start + 1;

  while (j < source.length) {
    const ch = source.charAt(j);

    if (ch === '\\') {
      j += 2;
      continue;
    }

    if (ch === quote) return j + 1;
    if (ch === '\n') return -1;
    j++;
  }

  return -1;
}

/** Koniec template stringa (indeks za backtickiem) i czy zawiera `${}`; niezamkniety -> koniec pliku. */
function scanTemplate(source: string, start: number): { end: number; hasExpression: boolean } {
  let j = start + 1;
  let hasExpression = false;

  while (j < source.length) {
    const ch = source.charAt(j);

    if (ch === '\\') {
      j += 2;
      continue;
    }

    if (ch === '`') return { end: j + 1, hasExpression };

    if (ch === '$' && source.charAt(j + 1) === '{') {
      hasExpression = true;
      j = scanTemplateExpression(source, j + 2);
      continue;
    }

    j++;
  }

  return { end: source.length, hasExpression };
}

/** Pomija wyrazenie `${ ... }` (z zagniezdzonymi nawiasami, stringami i template'ami); zwraca indeks za `}`. */
function scanTemplateExpression(source: string, start: number): number {
  let depth = 1;
  let j = start;

  while (j < source.length) {
    const ch = source.charAt(j);

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return j + 1;
    } else if (ch === "'" || ch === '"') {
      const end = scanString(source, j, ch);

      j = end === -1 ? j + 1 : end;
      continue;
    } else if (ch === '`') {
      j = scanTemplate(source, j).end;
      continue;
    }

    j++;
  }

  return source.length;
}

/** Dzieli zrodlo na tokeny istotne dla importow. Komentarze sa pomijane, numery linii zachowane. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;
  let line = 1;
  const push = (type: TokenType, value: string, text: string | null = null): void => {
    tokens.push({ type, value, line, text });
  };

  while (i < n) {
    const ch = source.charAt(i);

    if (ch === '\n') {
      line++;
      i++;
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v') {
      i++;
      continue;
    }

    if (ch === '/') {
      const next = source.charAt(i + 1);

      if (next === '/') {
        const end = source.indexOf('\n', i);

        i = end === -1 ? n : end;
        continue;
      }

      if (next === '*') {
        const close = source.indexOf('*/', i + 2);
        const end = close === -1 ? n : close + 2;

        line += countNewlines(source.slice(i, end));
        i = end;
        continue;
      }

      if (regexAllowedAfter(tokens.at(-1))) {
        const end = scanRegex(source, i);

        if (end !== -1) {
          push('other', source.slice(i, end));
          i = end;
          continue;
        }
      }

      push('punct', '/');
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const end = scanString(source, i, ch);

      if (end === -1) {
        push('other', ch);
        i++;
        continue;
      }

      push('string', source.slice(i, end), source.slice(i + 1, end - 1));
      i = end;
      continue;
    }

    if (ch === '`') {
      const { end, hasExpression } = scanTemplate(source, i);
      const raw = source.slice(i, end);

      push('template', raw, hasExpression ? null : raw.slice(1, raw.endsWith('`') ? -1 : undefined));
      line += countNewlines(raw);
      i = end;
      continue;
    }

    if (isIdentStart(ch)) {
      let j = i + 1;

      while (j < n && isIdentPart(source.charAt(j))) j++;
      push('ident', source.slice(i, j));
      i = j;
      continue;
    }

    if (isDigit(ch)) {
      let j = i + 1;

      while (j < n && /[\w.]/.test(source.charAt(j))) j++;
      push('other', source.slice(i, j));
      i = j;
      continue;
    }

    push('punct', ch);
    i++;
  }

  return tokens;
}

const isPunct = (token: Token | undefined, value: string): boolean =>
  token !== undefined && token.type === 'punct' && token.value === value;
const isIdent = (token: Token | undefined, value: string): boolean =>
  token !== undefined && token.type === 'ident' && token.value === value;
const literalText = (token: Token | undefined): string | null =>
  token !== undefined && (token.type === 'string' || token.type === 'template') ? token.text : null;

interface Match {
  record: ImportRecord;
  /** indeks ostatniego zuzytego tokenu */
  end: number;
}

function readImport(tokens: Token[], i: number): Match | null {
  const keyword = tokens[i];
  const next = tokens[i + 1];

  if (!keyword || !next) return null;

  if (isPunct(next, '(')) {
    const specifier = literalText(tokens[i + 2]);

    if (specifier === null) return null;

    return { record: { specifier, line: keyword.line, kind: 'dynamic', typeOnly: false }, end: i + 2 };
  }

  if (isPunct(next, '.')) return null;

  if (next.type === 'string' && next.text !== null) {
    return {
      record: { specifier: next.text, line: keyword.line, kind: 'static', typeOnly: false },
      end: i + 1,
    };
  }

  const after = tokens[i + 2];
  const typeOnly =
    isIdent(next, 'type') &&
    after !== undefined &&
    (isPunct(after, '{') || isPunct(after, '*') || (after.type === 'ident' && after.value !== 'from'));
  const limit = Math.min(tokens.length, i + MAX_IMPORT_TOKENS);

  for (let j = i + 1; j < limit; j++) {
    const token = tokens[j];

    if (!token) break;

    if (token.type === 'string') {
      if (!isIdent(tokens[j - 1], 'from') || token.text === null) return null;

      return { record: { specifier: token.text, line: keyword.line, kind: 'static', typeOnly }, end: j };
    }

    if (isPunct(token, ';') || isIdent(token, 'import') || isIdent(token, 'export')) return null;
  }

  return null;
}

function readReexport(tokens: Token[], i: number): Match | null {
  const keyword = tokens[i];

  if (!keyword) return null;
  let j = i + 1;
  let typeOnly = false;

  if (isIdent(tokens[j], 'type')) {
    typeOnly = true;
    j++;
  }

  const clause = tokens[j];

  if (!clause) return null;
  let k: number;

  if (isPunct(clause, '{')) {
    k = j + 1;
    const limit = Math.min(tokens.length, j + MAX_IMPORT_TOKENS);

    while (k < limit && !isPunct(tokens[k], '}')) {
      if (isPunct(tokens[k], ';') || isPunct(tokens[k], '{')) return null;
      k++;
    }

    k++;
  } else if (isPunct(clause, '*')) {
    k = j + 1;
    if (isIdent(tokens[k], 'as')) k += 2;
  } else {
    return null;
  }

  const specifier = tokens[k + 1];

  if (!isIdent(tokens[k], 'from') || !specifier || specifier.type !== 'string' || specifier.text === null)
    return null;

  return {
    record: { specifier: specifier.text, line: keyword.line, kind: 'reexport', typeOnly },
    end: k + 1,
  };
}

function readRequire(tokens: Token[], i: number): Match | null {
  const keyword = tokens[i];
  const arg = tokens[i + 2];

  if (!keyword || !isPunct(tokens[i + 1], '(') || !arg || arg.type !== 'string' || arg.text === null)
    return null;

  if (!isPunct(tokens[i + 3], ')')) return null;

  return {
    record: { specifier: arg.text, line: keyword.line, kind: 'require', typeOnly: false },
    end: i + 3,
  };
}

/** Czy prolog pliku (ciag literalow tekstowych jako instrukcji) zawiera dyrektywe `name`. */
function hasDirective(tokens: Token[], name: string): boolean {
  let j = 0;

  while (j < tokens.length) {
    const token = tokens[j];

    if (!token || token.type !== 'string') return false;
    if (token.text === name) return true;
    j++;
    if (isPunct(tokens[j], ';')) j++;
  }

  return false;
}

export function extractImports(source: string): ExtractedImports {
  const tokens = tokenize(source);
  const imports: ImportRecord[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token || token.type !== 'ident') continue;
    // `obj.import(...)`, `import.meta`, `module.require` - to nie sa deklaracje importu
    if (isPunct(tokens[i - 1], '.')) continue;
    let match: Match | null = null;

    if (token.value === 'import') match = readImport(tokens, i);
    else if (token.value === 'export') match = readReexport(tokens, i);
    else if (token.value === 'require') match = readRequire(tokens, i);

    if (match) {
      imports.push(match.record);
      i = match.end;
    }
  }

  return { imports, useClient: hasDirective(tokens, 'use client') };
}
