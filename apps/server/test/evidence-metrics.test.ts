// Lista miar w kontrakcie (EVIDENCE_METRICS) zgadza sie z tym, co silnik naprawde emituje: zadna regula nie pisze
// miary spoza listy, a lista nie trzyma miar, ktorych juz nikt nie emituje. Czyta zrodla regul jako tekst -
// kazdy dowod w silniku zapisuje miare literalem `metric: '...'`.
import { EVIDENCE_METRICS } from '@app/contracts';
import { describe, expect, it } from 'vitest';

const sources = Object.entries(
  import.meta.glob<string>('../src/**/*.ts', { eager: true, query: '?raw', import: 'default' }),
).filter(([path]) => !path.endsWith('.test.ts'));

const emitted = new Map<string, string[]>();

for (const [path, text] of sources) {
  for (const match of text.matchAll(/\bmetric: '([a-z0-9_]+)'/g)) {
    const metric = match[1] ?? '';

    emitted.set(metric, [...(emitted.get(metric) ?? []), path]);
  }
}

describe('EVIDENCE_METRICS', () => {
  it('czyta zrodla silnika (sanity check)', () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(emitted.has('precip_period')).toBe(true);
  });

  it('zadna regula nie emituje miary spoza listy', () => {
    const known = new Set<string>(EVIDENCE_METRICS);

    expect([...emitted.keys()].filter((metric) => !known.has(metric))).toEqual([]);
  });

  it('kazda miara z listy jest gdzies emitowana', () => {
    expect(EVIDENCE_METRICS.filter((metric) => !emitted.has(metric))).toEqual([]);
  });

  it('dowody nie dostaja miary z wyliczonego tekstu', () => {
    const dynamic = sources.flatMap(([path, text]) =>
      [...text.matchAll(/\bmetric: (?!')[^\s,}]+/g)].map((match) => `${path}: ${match[0]}`),
    );

    expect(dynamic).toEqual([]);
  });
});
