import { describe, expect, it } from 'vitest';

import { formatGithub, formatJson, formatText } from '../src/report';
import type { CheckResult } from '../src/types';

const result: CheckResult = {
  ok: false,
  filesScanned: 12,
  violations: [
    {
      rule: 'layers',
      file: 'apps/server/src/domain/job.ts',
      line: 3,
      message: "Warstwa 'domain' nie moze importowac 'lib'.",
    },
    { rule: 'layers', file: 'apps/server/src/modules/x.ts', line: 1, message: 'Druga, 100% pewna: a,b.' },
    { rule: 'package-deps', file: 'architecture.config.ts', line: 0, message: 'Cykl w grafie paczek.' },
  ],
  counts: { layers: 2, 'package-deps': 1 },
};

describe('formatText', () => {
  it('grupuje wedlug reguly z licznikiem i wypisuje path:line  rule  message', () => {
    const text = formatText(result);

    expect(text).toContain('layers (2)\n');
    expect(text).toContain(
      "  apps/server/src/domain/job.ts:3  layers  Warstwa 'domain' nie moze importowac 'lib'.\n",
    );
    expect(text).toContain(
      'package-deps (1)\n  architecture.config.ts  package-deps  Cykl w grafie paczek.\n',
    );
    expect(text).toContain('Razem: 3 naruszenia w 2 regulach (przeskanowano 12 plikow).');
  });

  it('dla czystego wyniku pisze OK', () => {
    expect(formatText({ ok: true, filesScanned: 1, violations: [], counts: {} })).toBe(
      'OK: brak naruszen architektury (przeskanowano 1 plik).\n',
    );
  });
});

describe('formatGithub', () => {
  it('emituje adnotacje ::error z plikiem, linia i tytulem, escapujac znaki specjalne', () => {
    const lines = formatGithub(result).trimEnd().split('\n');

    expect(lines[0]).toBe(
      "::error file=apps/server/src/domain/job.ts,line=3,title=architecture%3A layers::Warstwa 'domain' nie moze importowac 'lib'.",
    );
    expect(lines[1]).toBe(
      '::error file=apps/server/src/modules/x.ts,line=1,title=architecture%3A layers::Druga, 100%25 pewna: a,b.',
    );
    expect(lines[2]).toBe(
      '::error file=architecture.config.ts,title=architecture%3A package-deps::Cykl w grafie paczek.',
    );
    expect(lines[3]).toBe('::notice title=architecture::3 naruszen w 2 regulach');
  });
});

describe('formatJson', () => {
  it('zwraca pelny wynik jako JSON', () => {
    const parsed = JSON.parse(formatJson(result)) as CheckResult;

    expect(parsed.violations).toHaveLength(3);
    expect(parsed.counts).toEqual({ layers: 2, 'package-deps': 1 });
  });
});
