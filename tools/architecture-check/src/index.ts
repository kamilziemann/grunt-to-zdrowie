// @app/architecture-check - programowe API. CLI: src/cli/cli.ts. Reguly: src/rules/*. Konfiguracja: /architecture.config.ts.
import { resolve } from 'node:path';

import type { ArchitectureConfig } from './config';
import { toPosix } from './paths';
import { createResolver } from './resolver';
import { rules } from './rules';
import { analyzeFiles, scanFiles } from './scanner';
import type { CheckResult, Rule, RuleContext, RuleId, RunOptions, Violation } from './types';
import { RULE_IDS } from './types';
import { loadUnits } from './workspace';

export type {
  AppRules,
  ArchitectureConfig,
  FolderUnitRules,
  LayerRules,
  PackageRules,
  SiblingIsolation,
} from './config';
export { defineArchitecture } from './config';
export { extractImports } from './imports';
export { formatGithub, formatJson, formatReport, formatText, type ReportFormat } from './report';
export { createResolver, type Resolver, type ResolverOptions } from './resolver';
export type {
  AnalyzedFile,
  CheckResult,
  ImportKind,
  ImportRecord,
  Resolution,
  ResolvedImport,
  Rule,
  RuleContext,
  RuleId,
  RunOptions,
  ScannedFile,
  Violation,
  WorkspaceUnit,
} from './types';
export { RULE_IDS } from './types';

export const isRuleId = (value: string): value is RuleId => (RULE_IDS as readonly string[]).includes(value);

function selectRules(only: readonly string[] | undefined): readonly Rule[] {
  if (!only || only.length === 0) return rules;
  const unknown = only.filter((id) => !isRuleId(id));

  if (unknown.length > 0) {
    throw new Error(`Nieznane reguly: ${unknown.join(', ')}. Dostepne: ${RULE_IDS.join(', ')}.`);
  }

  return rules.filter((rule) => only.includes(rule.id));
}

const ruleOrder = new Map<RuleId, number>(RULE_IDS.map((id, index) => [id, index]));

function sortViolations(violations: Violation[]): Violation[] {
  return violations.toSorted(
    (a, b) =>
      (ruleOrder.get(a.rule) ?? 0) - (ruleOrder.get(b.rule) ?? 0) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.message.localeCompare(b.message),
  );
}

/** Skanuje `root` wedlug `config` i uruchamia reguly. `root` moze byc wzgledny do cwd. */
export async function runArchitectureCheck(
  config: ArchitectureConfig,
  root: string,
  options: RunOptions = {},
): Promise<CheckResult> {
  const selected = selectRules(options.only);
  const absoluteRoot = toPosix(resolve(root));
  const scanned = await scanFiles(absoluteRoot, config.include, config.exclude);
  const units = await loadUnits(
    config,
    absoluteRoot,
    scanned.map((file) => file.path),
  );
  const resolver = createResolver({ root: absoluteRoot, config, units });
  const files = analyzeFiles(scanned, resolver);
  const ctx: RuleContext = {
    config,
    root: absoluteRoot,
    configPath: options.configPath ?? 'architecture.config.ts',
    files,
    fileMap: new Map(files.map((file) => [file.path, file])),
    units,
  };
  const violations = sortViolations(selected.flatMap((rule) => rule.run(ctx)));
  const counts: Partial<Record<RuleId, number>> = {};

  for (const item of violations) counts[item.rule] = (counts[item.rule] ?? 0) + 1;

  return { ok: violations.length === 0, filesScanned: files.length, violations, counts };
}
