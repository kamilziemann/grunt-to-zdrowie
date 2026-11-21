// Typy wewnetrzne checkera. Wszystkie sciezki sa wzgledne do roota monorepo i uzywaja `/` (takze na Windows).
import type { ArchitectureConfig } from '../config';

export type ImportKind = 'static' | 'reexport' | 'dynamic' | 'require';

/** Jeden import wyciagniety z pliku zrodlowego. */
export interface ImportRecord {
  specifier: string;
  /** numer linii (od 1) */
  line: number;
  kind: ImportKind;
  /** `import type` / `export type ... from` - znika w runtime (verbatimModuleSyntax) */
  typeOnly: boolean;
}

export interface ScannedFile {
  path: string;
  imports: ImportRecord[];
  /** plik zaczyna sie dyrektywa 'use client' */
  useClient: boolean;
}

export type UnitKind = 'app' | 'package' | 'tool';

/** Jednostka workspace: aplikacja lub paczka z architecture.config.ts albo wywnioskowany tool. */
export interface WorkspaceUnit {
  /** nazwa paczki npm, np. @app/db */
  name: string;
  /** katalog wzgledem roota, np. packages/db */
  dir: string;
  kind: UnitKind;
  /** czy jednostka jest zadeklarowana w architecture.config.ts (tools nie musza byc) */
  declared: boolean;
  /**
   * `exports` z package.json: klucz to subpath bez `./` ('.' dla glownego wejscia, moze zawierac `*`),
   * wartosc to sciezka pliku wzgledem roota (null, gdy nie da sie jej odczytac). null = brak pola `exports`.
   */
  exports: Map<string, string | null> | null;
  /** `main`/`module` z package.json wzgledem roota (fallback dla paczek bez `exports`) */
  main: string | null;
}

export type ResolutionKind = 'file' | 'workspace' | 'external' | 'unresolved';

export interface Resolution {
  kind: ResolutionKind;
  /** sciezka docelowa wzgledem roota (takze dla `unresolved`, gdy znana z nazwy) */
  path: string | null;
  /** jednostka docelowa: dla plikow z zawierania katalogu, dla specyfikatorow workspace z nazwy paczki */
  unit: WorkspaceUnit | null;
  /** dla specyfikatorow workspace: czesc po nazwie paczki (bez `/`), null dla importu glownego */
  subpath: string | null;
  /** dla specyfikatorow workspace: subpath jest zadeklarowany w `exports` package.json */
  exported: boolean;
  /** import wzgledny, ktory wyszedl poza jednostke pliku importujacego */
  crossesUnit: boolean;
}

export interface ResolvedImport extends ImportRecord {
  resolved: Resolution;
}

export interface AnalyzedFile {
  path: string;
  useClient: boolean;
  unit: WorkspaceUnit | null;
  imports: ResolvedImport[];
}

export const RULE_IDS = [
  'package-deps',
  'no-app-import',
  'deep-import',
  'cycles',
  'layers',
  'forbidden-modules',
  'siblings',
  'folder-units',
  'type-only',
  'dynamic-import',
  'server-client',
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export interface Violation {
  rule: RuleId;
  /** sciezka wzgledem roota; dla problemow z konfiguracja - sciezka pliku konfiguracji */
  file: string;
  /** numer linii od 1; 0 = dotyczy calego pliku */
  line: number;
  message: string;
}

export interface RuleContext {
  config: ArchitectureConfig;
  /** bezwzgledny katalog roota monorepo (POSIX) - dla regul, ktore czytaja katalogi, a nie tylko zeskanowane pliki */
  root: string;
  /** sciezka pliku konfiguracji (do raportowania problemow z sama konfiguracja) */
  configPath: string;
  files: AnalyzedFile[];
  fileMap: Map<string, AnalyzedFile>;
  units: WorkspaceUnit[];
}

export interface Rule {
  id: RuleId;
  description: string;
  run(ctx: RuleContext): Violation[];
}

export interface CheckResult {
  ok: boolean;
  filesScanned: number;
  violations: Violation[];
  /** liczba naruszen per regula (tylko reguly z naruszeniami) */
  counts: Partial<Record<RuleId, number>>;
}

export interface RunOptions {
  /** uruchom tylko te reguly */
  only?: readonly string[];
  /** sciezka pliku konfiguracji do raportow (domyslnie architecture.config.ts) */
  configPath?: string;
}
