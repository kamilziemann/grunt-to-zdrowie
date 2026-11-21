// Rozwiazywanie specyfikatorow importu na pliki/jednostki workspace.
// - `./x`, `../x`  -> plik (probowane rozszerzenia .ts/.tsx/.js/.mjs i index.*)
// - `@/x`          -> <app>/src/x (alias aplikacji)
// - `@scope/pkg[/sub]` -> paczka/aplikacja z konfiguracji; subpath sprawdzany z `exports` package.json
// - reszta         -> modul zewnetrzny (node_modules, node:, bun:, cloudflare:)
import { statSync } from 'node:fs';

import type { ArchitectureConfig } from '../config';
import { dirnamePosix, extnamePosix, joinPosix } from '../paths';
import type { Resolution, WorkspaceUnit } from '../types';
import { unitOfPath } from '../workspace';

export interface ResolverOptions {
  root: string;
  config: ArchitectureConfig;
  units: readonly WorkspaceUnit[];
  /** test: wirtualny system plikow; domyslnie statSync na dysku (z pamiecia podreczna) */
  isFile?: (path: string) => boolean;
}

export interface Resolver {
  resolve(from: string, specifier: string): Resolution;
  unitOf(path: string): WorkspaceUnit | null;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const RESOLVABLE_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  '.json',
  '.css',
  '.svg',
  '.wasm',
  '.md',
  '.txt',
]);
const JS_TO_TS: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

const unresolved = (path: string | null): Resolution => ({
  kind: 'unresolved',
  path,
  unit: null,
  subpath: null,
  exported: false,
  crossesUnit: false,
});

const EXTERNAL: Resolution = {
  kind: 'external',
  path: null,
  unit: null,
  subpath: null,
  exported: true,
  crossesUnit: false,
};

function diskIsFile(root: string): (path: string) => boolean {
  const cache = new Map<string, boolean>();

  return (path) => {
    const cached = cache.get(path);

    if (cached !== undefined) return cached;
    let result = false;

    try {
      result = statSync(`${root}/${path}`).isFile();
    } catch {
      result = false;
    }

    cache.set(path, result);

    return result;
  };
}

export function createResolver(options: ResolverOptions): Resolver {
  const { config, units } = options;
  const isFile = options.isFile ?? diskIsFile(options.root);
  const scopePrefix = `${config.scope}/`;

  /** Istniejacy plik dla kandydata (bez rozszerzenia, z .js zamiast .ts, albo katalog z index.*). */
  const probeFile = (candidate: string): string | null => {
    const ext = extnamePosix(candidate);

    if (RESOLVABLE_EXTENSIONS.has(ext) && isFile(candidate)) return candidate;

    for (const tsExt of JS_TO_TS[ext] ?? []) {
      const swapped = candidate.slice(0, -ext.length) + tsExt;

      if (isFile(swapped)) return swapped;
    }

    for (const sourceExt of SOURCE_EXTENSIONS) {
      if (isFile(candidate + sourceExt)) return candidate + sourceExt;
    }

    for (const sourceExt of SOURCE_EXTENSIONS) {
      if (isFile(`${candidate}/index${sourceExt}`)) return `${candidate}/index${sourceExt}`;
    }

    return null;
  };

  const resolveFile = (from: string, candidate: string): Resolution => {
    if (candidate.startsWith('../') || candidate === '..') return unresolved(candidate);
    const found = probeFile(candidate);
    const path = found ?? candidate;
    const unit = unitOfPath(units, path);
    const fromUnit = unitOfPath(units, from);

    return {
      kind: found === null ? 'unresolved' : 'file',
      path,
      unit,
      subpath: null,
      exported: true,
      crossesUnit: fromUnit !== null && unit !== fromUnit,
    };
  };

  /** Plik za subpathem z `exports` (dokladny klucz albo wzorzec z `*`). */
  const exportedPath = (unit: WorkspaceUnit, subpath: string): { exported: boolean; path: string | null } => {
    const exact = unit.exports?.get(subpath);

    if (unit.exports?.has(subpath)) return { exported: true, path: exact ?? null };

    for (const [key, target] of unit.exports ?? []) {
      const star = key.indexOf('*');

      if (star === -1) continue;
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);

      if (subpath.length < prefix.length + suffix.length) continue;
      if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue;
      const captured = subpath.slice(prefix.length, subpath.length - suffix.length);

      return { exported: true, path: target === null ? null : target.replace('*', captured) };
    }

    return { exported: false, path: null };
  };

  const entryPath = (unit: WorkspaceUnit): string | null => {
    const fromExports = unit.exports?.get('.');

    if (typeof fromExports === 'string') return probeFile(fromExports) ?? fromExports;
    if (unit.main !== null) return probeFile(unit.main) ?? unit.main;

    return probeFile(`${unit.dir}/src/index`) ?? probeFile(`${unit.dir}/index`);
  };

  const resolveWorkspace = (specifier: string): Resolution => {
    const rest = specifier.slice(scopePrefix.length);
    const slash = rest.indexOf('/');
    const packageName = slash === -1 ? rest : rest.slice(0, slash);
    const subpath = slash === -1 ? null : rest.slice(slash + 1);
    const unit = units.find((candidate) => candidate.name === `${config.scope}/${packageName}`);

    if (!unit) return EXTERNAL;

    if (subpath === null || subpath === '') {
      return {
        kind: 'workspace',
        path: entryPath(unit),
        unit,
        subpath: null,
        exported: true,
        crossesUnit: false,
      };
    }

    const viaExports = exportedPath(unit, subpath);
    const path =
      viaExports.path === null
        ? probeFile(`${unit.dir}/${subpath}`)
        : (probeFile(viaExports.path) ?? viaExports.path);

    return { kind: 'workspace', path, unit, subpath, exported: viaExports.exported, crossesUnit: false };
  };

  return {
    unitOf: (path) => unitOfPath(units, path),
    resolve(from, specifier) {
      if (
        specifier.startsWith('./') ||
        specifier.startsWith('../') ||
        specifier === '.' ||
        specifier === '..'
      ) {
        return resolveFile(from, joinPosix(dirnamePosix(from), specifier));
      }

      if (specifier.startsWith('@/')) {
        const fromUnit = unitOfPath(units, from);

        if (!fromUnit || fromUnit.kind !== 'app') return unresolved(null);

        return resolveFile(from, joinPosix(fromUnit.dir, 'src', specifier.slice(2)));
      }

      if (specifier.startsWith(scopePrefix)) return resolveWorkspace(specifier);
      if (specifier.startsWith('/') || /^[A-Za-z]:[\\/]/.test(specifier)) return unresolved(null);

      return EXTERNAL;
    },
  };
}
