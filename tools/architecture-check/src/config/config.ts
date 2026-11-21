// Typ konfiguracji architektury. Jedyne zrodlo prawdy to /architecture.config.ts; AGENTS.md opisuje te same reguly slowami.
export interface LayerRules {
  /** nazwa warstwy -> glob katalogu wzgledem katalogu aplikacji */
  layers: Record<string, string>;
  /** warstwa -> warstwy, ktore moze importowac (siebie zawsze moze) */
  allowed: Record<string, string[]>;
  /** warstwa -> prefiksy specyfikatorow modulow, ktorych nie wolno importowac (np. 'hono', 'drizzle-orm') */
  forbiddenModules?: Record<string, string[]>;
}

export interface SiblingIsolation {
  /** katalog z rodzenstwem, np. src/modules lub src/features */
  dir: string;
  /** plik publicznego API rodzenstwa; import z rodzenstwa jest dozwolony tylko przez niego (pusty = zakaz calkowity) */
  publicFile: string;
}

export interface FolderUnitRules {
  /**
   * katalogi (globy sciezek wzgledem roota monorepo), w ktorych kazda jednostka (funkcja, komponent, modul) ma wlasny
   * folder <katalog>/<nazwa>/ z <nazwa>.ts(x), testami i index.ts (publiczne API). Katalog z listy, ktory lezy w innym
   * katalogu z listy (np. lib/utils w lib), jest grupa: sam nie jest jednostka, a jego podfoldery sa.
   */
  dirs: string[];
  /** pliki dozwolone bezposrednio w takim katalogu (np. index.ts) - poza nimi plik musi lezec w folderze jednostki */
  allowRootFiles: string[];
  /** podkatalogi, ktore nie sa jednostkami (np. dane generowane); globy sciezek wzgledem roota */
  ignore?: string[];
}

export interface AppRules {
  dir: string;
  layers?: LayerRules;
  siblings?: SiblingIsolation[];
  /** pliki serwerowe (nie moga byc importowane przez pliki z 'use client' ani przez components/ui) */
  serverOnly?: string[];
  /** katalogi, ktore nie moga importowac features (np. components/ui) */
  noFeatureImportsFrom?: string[];
}

export interface PackageRules {
  dir: string;
  /** paczki workspace, ktore wolno importowac */
  allowed: string[];
}

export interface TypeOnlyPair {
  from: string;
  to: string;
  /**
   * Swiadomy wyjatek: import w runtime dozwolony tylko z tych plikow aplikacji `from` (globy wzgledem jej katalogu) i
   * tylko tych specyfikatorow - np. wejscie jedynego Workera montuje API z innej aplikacji.
   */
  runtime?: { files: string[]; specifiers: string[] };
}

export interface ArchitectureConfig {
  scope: string;
  /** globy plikow do skanowania (wzgledem root) */
  include: string[];
  exclude: string[];
  packages: Record<string, PackageRules>;
  apps: Record<string, AppRules>;
  /** importy miedzy aplikacjami dozwolone wylacznie jako `import type` (wyjatek runtime: patrz TypeOnlyPair) */
  typeOnlyImports: TypeOnlyPair[];
  /** importy dynamiczne: dozwolone tylko w tych globach */
  dynamicImports: { allow: string[] };
  /** glebokie importy do paczek workspace (np. @app/db/src/x) sa zakazane; wyjatki: subpath exports */
  deepImports: { allowSubpaths: string[] };
  /** folder na jednostke: brak pliku luzem w katalogu i import tylko przez folder (index.ts) jednostki; brak = regula wylaczona */
  folderUnits?: FolderUnitRules;
}

export function defineArchitecture(config: ArchitectureConfig): ArchitectureConfig {
  return config;
}
