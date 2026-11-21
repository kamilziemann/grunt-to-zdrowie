// Jednostki workspace: aplikacje i paczki z konfiguracji + wywnioskowane katalogi (np. tools/*) z plikow.
// Z package.json czytamy `exports` (co wolno importowac spoza paczki) i `main`.
import type { ArchitectureConfig } from '../config';
import { firstSegment, joinPosix, normalizePosix } from '../paths';
import type { UnitKind, WorkspaceUnit } from '../types';

interface PackageManifest {
  name?: unknown;
  main?: unknown;
  module?: unknown;
  exports?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Pierwsza sciezka w (zagniezdzonym) obiekcie warunkow eksportu, np. { types, default }. */
function pickTarget(value: unknown): string | null {
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickTarget(item);

      if (found !== null) return found;
    }

    return null;
  }

  if (isRecord(value)) {
    for (const key of ['types', 'default', 'import', 'bun', 'node', 'worker', 'browser']) {
      if (key in value) {
        const found = pickTarget(value[key]);

        if (found !== null) return found;
      }
    }

    for (const nested of Object.values(value)) {
      const found = pickTarget(nested);

      if (found !== null) return found;
    }
  }

  return null;
}

const stripDotSlash = (key: string): string => (key === '.' ? '.' : key.replace(/^\.\//, ''));

/** Mapa exports (klucz bez `./`, wartosc wzgledem roota) z pola `exports` package.json. */
export function parseExports(exportsField: unknown, dir: string): Map<string, string | null> | null {
  if (exportsField === undefined || exportsField === null) return null;
  const map = new Map<string, string | null>();
  const toRoot = (target: string | null): string | null => (target === null ? null : joinPosix(dir, target));

  if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
    map.set('.', toRoot(pickTarget(exportsField)));

    return map;
  }

  if (!isRecord(exportsField)) return map;
  const keys = Object.keys(exportsField);
  const subpathMap = keys.every((key) => key.startsWith('.'));

  if (!subpathMap) {
    map.set('.', toRoot(pickTarget(exportsField)));

    return map;
  }

  for (const key of keys) map.set(stripDotSlash(key), toRoot(pickTarget(exportsField[key])));

  return map;
}

async function readManifest(root: string, dir: string): Promise<PackageManifest | null> {
  try {
    const file = Bun.file(`${root}/${dir}/package.json`);

    if (!(await file.exists())) return null;
    const json: unknown = await file.json();

    return isRecord(json) ? json : null;
  } catch {
    return null;
  }
}

async function buildUnit(
  root: string,
  name: string,
  dir: string,
  kind: UnitKind,
  declared: boolean,
): Promise<WorkspaceUnit> {
  const manifest = await readManifest(root, dir);
  const mainField = manifest?.main ?? manifest?.module;

  return {
    name: declared ? name : typeof manifest?.name === 'string' ? manifest.name : name,
    dir,
    kind,
    declared,
    exports: parseExports(manifest?.exports, dir),
    main: typeof mainField === 'string' ? joinPosix(dir, mainField) : null,
  };
}

const kindOfGroup = (group: string): UnitKind => {
  if (group === 'apps') return 'app';
  if (group === 'tools') return 'tool';

  return 'package';
};

interface UnitDescriptor {
  name: string;
  dir: string;
  kind: UnitKind;
  declared: boolean;
}

/** Jednostki z konfiguracji + wywnioskowane dla zeskanowanych plikow spoza nich (np. tools/fonts). */
export async function loadUnits(
  config: ArchitectureConfig,
  root: string,
  scannedPaths: readonly string[],
): Promise<WorkspaceUnit[]> {
  const descriptors: UnitDescriptor[] = [];

  for (const [name, rules] of Object.entries(config.packages)) {
    descriptors.push({ name, dir: normalizePosix(rules.dir), kind: 'package', declared: true });
  }

  for (const [name, rules] of Object.entries(config.apps)) {
    descriptors.push({ name, dir: normalizePosix(rules.dir), kind: 'app', declared: true });
  }

  const known = new Set(descriptors.map((descriptor) => descriptor.dir));

  for (const path of scannedPaths) {
    if (descriptors.some((descriptor) => path.startsWith(`${descriptor.dir}/`))) continue;
    const group = firstSegment(path);

    if (group === null) continue;
    const name = firstSegment(path.slice(group.length + 1));

    if (name === null) continue;
    const dir = `${group}/${name}`;

    if (known.has(dir)) continue;
    known.add(dir);
    descriptors.push({ name: dir, dir, kind: kindOfGroup(group), declared: false });
  }

  return Promise.all(
    descriptors.map((descriptor) =>
      buildUnit(root, descriptor.name, descriptor.dir, descriptor.kind, descriptor.declared),
    ),
  );
}

/** Jednostka zawierajaca sciezke (najdluzszy pasujacy katalog). */
export function unitOfPath(units: readonly WorkspaceUnit[], path: string): WorkspaceUnit | null {
  let best: WorkspaceUnit | null = null;

  for (const unit of units) {
    if (path === unit.dir || path.startsWith(`${unit.dir}/`)) {
      if (best === null || unit.dir.length > best.dir.length) best = unit;
    }
  }

  return best;
}
