// CLI uruchamiane jako osobny proces Bun na fixtures: kody wyjscia, formaty, --only, bledy uzycia.
import { describe, expect, it } from 'vitest';

import type { CheckResult } from '../src/types';

const PACKAGE_DIR = `${import.meta.dirname}/..`;
const FIXTURES = `${import.meta.dirname}/fixtures`;

function runCli(...args: string[]): { code: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(['bun', 'src/cli/cli.ts', ...args], {
    cwd: PACKAGE_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return { code: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

const fixtureArgs = (name: string): string[] => [
  '--config',
  `${FIXTURES}/${name}/architecture.config.ts`,
  '--root',
  `${FIXTURES}/${name}`,
];

describe('cli', () => {
  it('valid: kod 0 i komunikat OK', () => {
    const run = runCli(...fixtureArgs('valid'));

    expect(run.stderr).toBe('');
    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(/^OK: brak naruszen architektury/);
  });

  it('invalid: kod 1 i raport tekstowy pogrupowany regulami', () => {
    const run = runCli(...fixtureArgs('invalid'));

    expect(run.code).toBe(1);
    expect(run.stdout).toContain('layers (4)');
    expect(run.stdout).toContain('  apps/server/src/domain/job.ts:1  layers  ');
    expect(run.stdout).toContain('Razem: 35 naruszen w 11 regulach');
  });

  it('--json zwraca pelny wynik', () => {
    const run = runCli(...fixtureArgs('invalid'), '--json');

    expect(run.code).toBe(1);
    const result = JSON.parse(run.stdout) as CheckResult;

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(35);
    expect(result.counts.cycles).toBe(2);
  });

  it('--format github emituje adnotacje', () => {
    const run = runCli(...fixtureArgs('invalid'), '--format', 'github', '--only', 'cycles');

    expect(run.code).toBe(1);
    const lines = run.stdout.trimEnd().split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(
      /^::error file=apps\/server\/src\/lib\/format\.ts,line=1,title=architecture%3A cycles::Cykl importow/,
    );
    expect(lines[2]).toMatch(/^::notice /);
  });

  it('--only przyjmuje liste po przecinku i powtorzenia', () => {
    const run = runCli(...fixtureArgs('invalid'), '--only', 'layers,siblings', '--only=type-only', '--json');
    const result = JSON.parse(run.stdout) as CheckResult;

    expect(Object.keys(result.counts).toSorted()).toEqual(['layers', 'siblings', 'type-only']);
  });

  it('bledy uzycia daja kod 2', () => {
    expect(runCli('--nope').code).toBe(2);
    expect(runCli(...fixtureArgs('valid'), '--only', 'ghost').code).toBe(2);
    expect(runCli('--config', `${FIXTURES}/missing.config.ts`, '--root', FIXTURES).code).toBe(2);
    const badFormat = runCli(...fixtureArgs('valid'), '--format', 'xml');

    expect(badFormat.code).toBe(2);
    expect(badFormat.stderr).toContain("Nieznany format 'xml'");
  });

  it('--help wypisuje uzycie i konczy sie kodem 0', () => {
    const run = runCli('--help');

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('--only');
  });
});
