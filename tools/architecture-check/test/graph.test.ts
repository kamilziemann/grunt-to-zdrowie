import { describe, expect, it } from 'vitest';

import { shortestCycleThrough, stronglyConnectedComponents } from '../src/graph';

const graph = (edges: Record<string, string[]>): { nodes: string[]; edges: Map<string, string[]> } => ({
  nodes: Object.keys(edges),
  edges: new Map(Object.entries(edges)),
});

describe('stronglyConnectedComponents', () => {
  it('zwraca tylko skladowe z cyklem', () => {
    const g = graph({ a: ['b'], b: ['c'], c: ['a'], d: ['a'], e: [] });
    const components = stronglyConnectedComponents(g.nodes, g.edges).map((c) => c.toSorted());

    expect(components).toEqual([['a', 'b', 'c']]);
  });

  it('wykrywa petle wlasne i wiele skladowych', () => {
    const g = graph({ a: ['a'], b: ['c'], c: ['b'], d: ['e'], e: [] });
    const components = stronglyConnectedComponents(g.nodes, g.edges).map((c) => c.toSorted());

    expect(components.toSorted((x, y) => (x[0] ?? '').localeCompare(y[0] ?? ''))).toEqual([
      ['a'],
      ['b', 'c'],
    ]);
  });

  it('radzi sobie z dlugim lancuchem bez rekurencji', () => {
    const edges: Record<string, string[]> = {};

    for (let i = 0; i < 20000; i++) edges[`n${i}`] = [`n${i + 1}`];
    edges.n20000 = ['n0'];
    const g = graph(edges);
    const components = stronglyConnectedComponents(g.nodes, g.edges);

    expect(components).toHaveLength(1);
    expect(components[0]).toHaveLength(20001);
  });

  it('krawedzie do nieznanych wezlow nie psuja wyniku', () => {
    const g = graph({ a: ['ghost', 'b'], b: ['a'] });

    expect(stronglyConnectedComponents(g.nodes, g.edges).map((c) => c.toSorted())).toEqual([['a', 'b']]);
  });
});

describe('shortestCycleThrough', () => {
  it('znajduje najkrotszy cykl przez wezel startowy', () => {
    const g = graph({ a: ['b', 'c'], b: ['d'], d: ['a'], c: ['a'] });

    expect(shortestCycleThrough('a', new Set(g.nodes), g.edges)).toEqual(['a', 'c', 'a']);
  });

  it('obsluguje petle wlasna i brak cyklu', () => {
    const g = graph({ a: ['a', 'b'], b: [] });

    expect(shortestCycleThrough('a', new Set(['a']), g.edges)).toEqual(['a', 'a']);
    expect(shortestCycleThrough('b', new Set(['b']), g.edges)).toEqual(['b']);
  });
});
