// Wspolne drobiazgi regul: dopasowanie warstw, prefiksow modulow, wybor jednostek aplikacji.
import type { AppRules, LayerRules } from '../../config';
import { matchGlob } from '../../glob';
import type { AnalyzedFile, RuleContext, RuleId, Violation, WorkspaceUnit } from '../../types';

export interface AppEntry {
  name: string;
  rules: AppRules;
  unit: WorkspaceUnit;
  files: AnalyzedFile[];
}

/** Aplikacje z konfiguracji razem z ich jednostka i zeskanowanymi plikami. */
export function appEntries(ctx: RuleContext): AppEntry[] {
  const entries: AppEntry[] = [];

  for (const [name, rules] of Object.entries(ctx.config.apps)) {
    const unit = ctx.units.find((candidate) => candidate.name === name);

    if (!unit) continue;
    entries.push({ name, rules, unit, files: ctx.files.filter((file) => file.unit === unit) });
  }

  return entries;
}

/** Nazwa warstwy dla sciezki wzglednej do katalogu aplikacji: pierwszy pasujacy glob w kolejnosci deklaracji. */
export function layerOf(layers: LayerRules, relativePath: string): string | null {
  for (const [name, pattern] of Object.entries(layers.layers)) {
    if (matchGlob(pattern, relativePath)) return name;
  }

  return null;
}

/** Czy specyfikator pasuje do prefiksu modulu: 'hono' lapie 'hono' i 'hono/client', '@hono/' lapie '@hono/x'. */
export function matchesModulePrefix(specifier: string, prefix: string): boolean {
  if (prefix.endsWith('/')) return specifier.startsWith(prefix);

  return specifier === prefix || specifier.startsWith(`${prefix}/`);
}

export function violation(rule: RuleId, file: string, line: number, message: string): Violation {
  return { rule, file, line, message };
}

export const list = (items: readonly string[]): string => (items.length === 0 ? 'brak' : items.join(', '));
