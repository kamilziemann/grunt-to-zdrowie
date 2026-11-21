// cycles: cykle importow na poziomie plikow (Tarjan). Krawedzie: importy statyczne, re-eksporty i require,
// bez `import type` (znikaja w runtime) i bez import() (to standardowy sposob przerywania cykli).
import { shortestCycleThrough, stronglyConnectedComponents } from '../../graph';
import type { Rule, Violation } from '../../types';
import { violation } from '../helpers';

export const cycles: Rule = {
  id: 'cycles',
  description: 'Brak cykli importow miedzy plikami (kazda silnie spojna skladowa raportowana raz).',
  run(ctx) {
    const out: Violation[] = [];
    const edges = new Map<string, string[]>();

    for (const file of ctx.files) {
      const targets = new Set<string>();

      for (const imp of file.imports) {
        if (imp.typeOnly || imp.kind === 'dynamic') continue;
        const target = imp.resolved.path;

        if (target !== null && ctx.fileMap.has(target)) targets.add(target);
      }

      edges.set(file.path, [...targets]);
    }

    const nodes = ctx.files.map((file) => file.path);

    for (const component of stronglyConnectedComponents(nodes, edges)) {
      const members = component.toSorted();
      const first = members[0];

      if (first === undefined) continue;
      const cycle = shortestCycleThrough(first, new Set(members), edges);
      const next = cycle[1];
      const edge = ctx.fileMap
        .get(first)
        ?.imports.find((imp) => !imp.typeOnly && imp.kind !== 'dynamic' && imp.resolved.path === next);
      const extra =
        members.length > cycle.length - 1 ? ` (silnie spojna skladowa: ${members.length} plikow)` : '';

      out.push(violation('cycles', first, edge?.line ?? 0, `Cykl importow: ${cycle.join(' -> ')}${extra}.`));
    }

    return out;
  },
};
