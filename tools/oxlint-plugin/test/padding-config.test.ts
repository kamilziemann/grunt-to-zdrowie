// Konfiguracja `.oxlintrc.padding.json` (autofix + sprawdzanie samej reguly padding-lines) ma te same ignorePatterns co
// glowne `.oxlintrc.json` i wlacza wylacznie te jedna regule; test pilnuje, zeby nie rozjechaly sie z czasem.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type OxlintConfig = {
  ignorePatterns?: string[];
  jsPlugins?: string[];
  rules?: Record<string, unknown>;
};

const readConfig = (name: string): OxlintConfig =>
  JSON.parse(readFileSync(new URL(`../../../${name}`, import.meta.url), 'utf8')) as OxlintConfig;

describe('.oxlintrc.padding.json', () => {
  const main = readConfig('.oxlintrc.json');
  const padding = readConfig('.oxlintrc.padding.json');

  it('ma te same ignorePatterns co .oxlintrc.json', () => {
    expect(padding.ignorePatterns).toEqual(main.ignorePatterns);
  });

  it('laduje ten sam plugin i wlacza tylko regule padding-lines', () => {
    expect(padding.jsPlugins).toEqual(main.jsPlugins);
    expect(padding.rules).toEqual({ 'arch/padding-lines': 'error' });
  });

  it('regula jest wlaczona jako error w .oxlintrc.json', () => {
    expect(main.rules?.['arch/padding-lines']).toBe('error');
  });
});
