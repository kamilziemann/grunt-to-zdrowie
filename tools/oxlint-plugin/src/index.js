// Plugin oxlint (API zgodne z ESLint) z regulami granic architektury i ukladu kodu (puste linie). Szczegolowe,
// konfigurowalne reguly architektury (warstwy, cykle, import type) sa w tools/architecture-check; tutaj sa szybkie
// reguly "na pliku" dla edytora i pre-commit.
// Dokumentacja: https://oxc.rs/docs/guide/usage/linter/js-plugins.html
// Typy: oxlint nie eksportuje typow regul wprost, wiec wyprowadzamy je z sygnatury RuleTester.run (plugins-dev).

/** @typedef {Parameters<InstanceType<typeof import('oxlint/plugins-dev').RuleTester>['run']>[1]} Rule */
/** @typedef {NonNullable<Rule['create']>} CreateFn */
/** @typedef {Parameters<CreateFn>[0]} RuleContext */
/** @typedef {ReturnType<CreateFn>} Visitor */
/** @typedef {Parameters<NonNullable<Visitor['ImportDeclaration']>>[0]} ImportDeclarationNode */
/** @typedef {Parameters<NonNullable<Visitor['ExportNamedDeclaration']>>[0]} ExportNamedNode */
/** @typedef {Parameters<NonNullable<Visitor['ExportAllDeclaration']>>[0]} ExportAllNode */
/** @typedef {Parameters<NonNullable<Visitor['ImportExpression']>>[0]} ImportExpressionNode */
/** @typedef {ImportDeclarationNode | ExportNamedNode | ExportAllNode | ImportExpressionNode} ImportNode */
/** @typedef {(node: ImportNode, specifier: string) => void} ImportCheck */

const SCOPE = '@app';
const ALLOWED_SUBPATHS = [
  'http/hono',
  'env/server',
  'db/schema',
  'server/types',
  // wejscie serwera dla jedynego Workera (apps/web/src/worker.ts) - jak deepImports.allowSubpaths w architecture.config.ts
  'server/worker',
  'start-kit/worker',
  'rules/examples',
];
const APP_PACKAGES = [`${SCOPE}/server`, `${SCOPE}/web`];

/** @param {string} path */
const norm = (path) => path.replaceAll('\\', '/');

/**
 * Nazwa feature dla sciezki (.../src/features/<nazwa>/...), null gdy sciezka nie lezy w features.
 * @param {string} path
 * @returns {string | null}
 */
function featureOf(path) {
  const m = /\/src\/features\/([^/]+)(\/|$)/.exec(path);

  return m?.[1] ?? null;
}

/**
 * Rozwiazuje specyfikator wzgledny wzgledem pliku (bez dostepu do dysku, bez rozszerzen).
 * @param {string} from
 * @param {string} spec
 * @returns {string}
 */
function resolveRelative(from, spec) {
  const dir = from.split('/').slice(0, -1);

  for (const part of spec.split('/')) {
    if (part === '..') dir.pop();
    else if (part !== '.') dir.push(part);
  }

  return dir.join('/');
}

/**
 * Wartosc literalu zrodla importu (ImportExpression moze miec dowolne wyrazenie - wtedy null).
 * @param {unknown} source
 * @returns {string | null}
 */
function sourceValue(source) {
  if (typeof source !== 'object' || source === null || !('value' in source)) return null;
  const { value } = source;

  return typeof value === 'string' ? value : null;
}

/**
 * Visitor wolajacy `check` dla kazdego importu/re-eksportu/import() z literalnym zrodlem.
 * @param {ImportCheck} check
 * @returns {Visitor}
 */
function eachImport(check) {
  return {
    ImportDeclaration: (n) => {
      const spec = sourceValue(n.source);

      if (spec !== null) check(n, spec);
    },
    ExportNamedDeclaration: (n) => {
      const spec = sourceValue(n.source);

      if (spec !== null) check(n, spec);
    },
    ExportAllDeclaration: (n) => {
      const spec = sourceValue(n.source);

      if (spec !== null) check(n, spec);
    },
    ImportExpression: (n) => {
      const spec = sourceValue(n.source);

      if (spec !== null) check(n, spec);
    },
  };
}

/** @type {Rule} */
const noCrossFeatureImport = {
  meta: {
    type: 'problem',
    docs: { description: 'Feature nie importuje wnetrza innego feature (tylko jego index.ts).' },
  },
  create(context) {
    const file = norm(context.filename);
    const own = featureOf(file);

    // Regula dotyczy tylko plikow wewnatrz features (tak jak `siblings` w architecture-check);
    // pliki spoza (np. app/) moga importowac wnetrze feature, np. loader z features/x/server.
    if (own === null) return {};

    return eachImport((node, spec) => {
      let target = null;

      if (spec.startsWith('.')) target = resolveRelative(file, spec);
      else if (spec.startsWith('@/features/')) target = `/src/features/${spec.slice('@/features/'.length)}`;

      if (target === null) return;
      const other = featureOf(target);

      if (other === null || other === own) return;
      const rest = target.split(`/src/features/${other}`)[1] ?? '';

      if (rest === '' || rest === '/' || rest === '/index' || rest === '/index.ts' || rest === '/index.tsx') {
        return;
      }

      context.report({
        node,
        message: `Import wnetrza feature '${other}' (${spec}). Uzyj publicznego API: features/${other}/index.ts`,
      });
    });
  },
};

/** @type {Rule} */
const noDeepPackageImport = {
  meta: {
    type: 'problem',
    docs: { description: 'Zakaz glebokich importow do paczek workspace poza subpath exports.' },
  },
  create(context) {
    return eachImport((node, spec) => {
      if (!spec.startsWith(`${SCOPE}/`)) return;
      const rest = spec.slice(SCOPE.length + 1);

      if (!rest.includes('/')) return;
      if (ALLOWED_SUBPATHS.some((a) => rest === a || (a.endsWith('/') && rest.startsWith(a)))) return;
      context.report({
        node,
        message: `Gleboki import '${spec}'. Importuj z publicznego API paczki (package.json exports).`,
      });
    });
  },
};

/** @type {Rule} */
const noAppImportInPackage = {
  meta: { type: 'problem', docs: { description: 'Paczki i narzedzia nie importuja kodu aplikacji.' } },
  create(context) {
    const file = norm(context.filename);
    const inPackage = /\/(packages|tools)\/[^/]+\/src\//.test(file);

    if (!inPackage) return {};

    return eachImport((node, spec) => {
      const bad =
        APP_PACKAGES.some((a) => spec === a || spec.startsWith(`${a}/`)) ||
        (spec.startsWith('.') && /\/apps\//.test(resolveRelative(file, spec)));

      if (bad) {
        context.report({
          node,
          message: `Paczka importuje aplikacje ('${spec}'). Zaleznosc musi isc w druga strone.`,
        });
      }
    });
  },
};

// --- arch/padding-lines -------------------------------------------------------------------------------------
// Puste linie w listach instrukcji (Program, blok, static block, case, TSModuleBlock). Oxlint nie ma odpowiednika
// `padding-line-between-statements`, a oxfmt nigdy nie DODAJE pustych linii, wiec regula ma autofix; `bun run format`
// uruchamia go PO oxfmt (osobna konfiguracja z sama ta regula: .oxlintrc.padding.json w korzeniu repo).

/** @typedef {Parameters<NonNullable<Visitor['Program']>>[0]} ProgramNode */
/** @typedef {ProgramNode['body'][number]} ListItem */
/** @typedef {Parameters<NonNullable<Visitor['Program']>>[0]['comments'][number]} CommentNode */
/** @typedef {{ readonly type: string, readonly id?: unknown }} Declared */

// Instrukcje "blokowe": wokol wieloliniowej takiej instrukcji wymagamy pustych linii (chyba ze jest pierwsza/ostatnia).
const BLOCK_LIKE_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
  'LabeledStatement',
  'BlockStatement',
  'FunctionDeclaration',
  'TSDeclareFunction',
  'ClassDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
]);

/**
 * Deklaracja zawarta w `export` (`export const x`, `export default function f() {}`); inaczej sam wezel.
 * @param {ListItem} node
 * @returns {Declared}
 */
function declared(node) {
  if (
    (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') &&
    node.declaration
  ) {
    return node.declaration;
  }

  return node;
}

/** @param {ListItem} node */
const isDirective = (node) => node.type === 'ExpressionStatement' && typeof node.directive === 'string';

/**
 * Nazwa deklaracji (`id.name`) albo null.
 * @param {Declared} node
 * @returns {string | null}
 */
function nameOf(node) {
  const { id } = node;

  if (typeof id !== 'object' || id === null || !('name' in id)) return null;

  return typeof id.name === 'string' ? id.name : null;
}

/**
 * Przeciazenia funkcji (`function f(a: string): void;` + `function f(a: number): void;` + implementacja) sa jedna calosc.
 * @param {Declared} prev
 * @param {Declared} curr
 */
function isOverloadPair(prev, curr) {
  const name = nameOf(prev);
  const isFunction = curr.type === 'FunctionDeclaration' || curr.type === 'TSDeclareFunction';

  return prev.type === 'TSDeclareFunction' && isFunction && name !== null && name === nameOf(curr);
}

/**
 * Powod wymaganej pustej linii miedzy sasiednimi instrukcjami albo null, gdy nic nie jest wymagane.
 * @param {ListItem} prev
 * @param {ListItem} curr
 * @returns {string | null}
 */
function paddingReason(prev, curr) {
  const before = declared(prev);
  const after = declared(curr);

  if (isOverloadPair(before, after)) return null;
  if (curr.type === 'ReturnStatement') return "przed 'return'";
  if (curr.type === 'ThrowStatement') return "przed 'throw'";

  if (before.type === 'VariableDeclaration' && after.type !== 'VariableDeclaration') {
    return 'po deklaracjach zmiennych';
  }

  const multiline = (/** @type {ListItem} */ node) => node.loc.start.line !== node.loc.end.line;

  if (BLOCK_LIKE_TYPES.has(before.type) && multiline(prev)) return 'po wieloliniowym bloku';
  if (BLOCK_LIKE_TYPES.has(after.type) && multiline(curr)) return 'przed wieloliniowym blokiem';

  return null;
}

/** @type {Rule} */
const paddingLines = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        "Pusta linia przed 'return'/'throw', po deklaracjach zmiennych i wokol wieloliniowych blokow (if/for/while/switch/try/funkcje/klasy).",
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;
    const { text } = sourceCode;
    /** @type {CommentNode[] | null} */
    let allComments = null;

    /**
     * Komentarze miedzy dwiema pozycjami (wg poczatku komentarza), po binarnym wyszukaniu pierwszego.
     * @param {number} from
     * @param {number} to
     * @returns {CommentNode[]}
     */
    function commentsBetween(from, to) {
      allComments ??= sourceCode.getAllComments();
      let low = 0;
      let high = allComments.length;

      while (low < high) {
        const mid = (low + high) >> 1;
        const comment = allComments[mid];

        if (comment !== undefined && comment.range[0] < from) low = mid + 1;
        else high = mid;
      }

      /** @type {CommentNode[]} */
      const found = [];

      for (let i = low; i < allComments.length; i++) {
        const comment = allComments[i];

        if (comment === undefined || comment.range[0] >= to) break;
        found.push(comment);
      }

      return found;
    }

    /**
     * @param {ListItem} prev
     * @param {ListItem} curr
     * @param {string} reason
     */
    function report(prev, curr, reason) {
      const between = commentsBetween(prev.range[1], curr.range[0]);

      // Czy miedzy prev a curr (razem z komentarzami) jest juz pusta linia?
      let endLine = prev.loc.end.line;

      for (const comment of between) {
        if (comment.loc.start.line - endLine > 1) return;
        endLine = comment.loc.end.line;
      }

      if (curr.loc.start.line - endLine > 1) return;

      // Komentarze zaczynajace sie w linii konca prev (lub ciagnace sie z niej) naleza do prev; pusta linia idzie
      // zaraz za nimi, a wiec PRZED komentarzami prowadzacymi curr.
      let anchor = prev.range[1];
      let anchorLine = prev.loc.end.line;
      let leading = 0;

      while (leading < between.length) {
        const comment = between[leading];

        if (comment === undefined || comment.loc.start.line !== anchorLine) break;
        anchor = comment.range[1];
        anchorLine = comment.loc.end.line;
        leading += 1;
      }

      const nextStart = between[leading]?.range[0] ?? curr.range[0];
      const gap = text.slice(anchor, nextStart);
      const newline = gap.indexOf('\n');
      const eol = newline > 0 && gap[newline - 1] === '\r' ? '\r\n' : '\n';

      context.report({
        loc: { start: curr.loc.start, end: sourceCode.getLocFromIndex(curr.range[0] + 1) },
        message: `Wymagana pusta linia ${reason}.`,
        fix: (fixer) => {
          if (newline >= 0)
            return fixer.insertTextBeforeRange([anchor + newline + 1, anchor + newline + 1], eol);

          // Obie instrukcje w jednej linii: rozdzielamy je pusta linia (wciecie poprawi oxfmt).
          const indent = /^[ \t]*/.exec(sourceCode.lines[prev.loc.start.line - 1] ?? '')?.[0] ?? '';

          return fixer.replaceTextRange([anchor, nextStart], `${eol}${eol}${indent}`);
        },
      });
    }

    /** @param {readonly ListItem[]} list */
    function checkList(list) {
      const items = list.filter((node) => node.type !== 'EmptyStatement');
      // Dyrektywy ('use client') zostaja na poczatku i same nie wymagaja odstepow; pierwsza "prawdziwa" instrukcja
      // jest tu traktowana jak pierwsza w bloku.
      const first = items.findIndex((node) => !isDirective(node));

      if (first < 0) return;

      for (let i = first + 1; i < items.length; i++) {
        const prev = items[i - 1];
        const curr = items[i];

        if (prev === undefined || curr === undefined) continue;
        const reason = paddingReason(prev, curr);

        if (reason !== null) report(prev, curr, reason);
      }
    }

    return {
      Program: (node) => checkList(node.body),
      BlockStatement: (node) => checkList(node.body),
      StaticBlock: (node) => checkList(node.body),
      SwitchCase: (node) => checkList(node.consequent),
      TSModuleBlock: (node) => checkList(node.body),
    };
  },
};

const plugin = {
  meta: { name: 'arch' },
  rules: {
    'no-cross-feature-import': noCrossFeatureImport,
    'no-deep-package-import': noDeepPackageImport,
    'no-app-import-in-package': noAppImportInPackage,
    'padding-lines': paddingLines,
  },
};

export default plugin;
