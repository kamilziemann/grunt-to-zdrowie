// Silnie spojne skladowe (Tarjan, iteracyjnie) + najkrotszy cykl przez wezel (BFS) do czytelnego raportu.

/** Zwraca skladowe o rozmiarze > 1 oraz petle wlasne (a -> a). */
export function stronglyConnectedComponents(
  nodes: readonly string[],
  edges: ReadonlyMap<string, readonly string[]>,
): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];
  let counter = 0;

  const enter = (node: string): void => {
    index.set(node, counter);
    low.set(node, counter);
    counter++;
    stack.push(node);
    onStack.add(node);
  };

  const visit = (start: string): void => {
    const work: { node: string; next: number }[] = [{ node: start, next: 0 }];

    enter(start);

    while (work.length > 0) {
      const frame = work.at(-1);

      if (!frame) break;
      const targets = edges.get(frame.node) ?? [];

      if (frame.next < targets.length) {
        const target = targets[frame.next];

        frame.next++;
        if (target === undefined) continue;

        if (!index.has(target)) {
          enter(target);
          work.push({ node: target, next: 0 });
        } else if (onStack.has(target)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, index.get(target) ?? 0));
        }

        continue;
      }

      work.pop();
      const parent = work.at(-1);

      if (parent) low.set(parent.node, Math.min(low.get(parent.node) ?? 0, low.get(frame.node) ?? 0));

      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let popped: string | undefined;

        do {
          popped = stack.pop();
          if (popped === undefined) break;
          onStack.delete(popped);
          component.push(popped);
        } while (popped !== frame.node);

        const selfLoop = component.length === 1 && (edges.get(frame.node) ?? []).includes(frame.node);

        if (component.length > 1 || selfLoop) result.push(component.toReversed());
      }
    }
  };

  for (const node of nodes) if (!index.has(node)) visit(node);

  return result;
}

/** Najkrotszy cykl przez `start` wewnatrz `members`, jako [start, ..., start]. Gdy brak cyklu: [start]. */
export function shortestCycleThrough(
  start: string,
  members: ReadonlySet<string>,
  edges: ReadonlyMap<string, readonly string[]>,
): string[] {
  const parent = new Map<string, string | null>([[start, null]]);
  const queue = [start];

  while (queue.length > 0) {
    const node = queue.shift();

    if (node === undefined) break;

    for (const target of edges.get(node) ?? []) {
      if (!members.has(target)) continue;

      if (target === start) {
        const path: string[] = [];

        for (let cursor: string | null = node; cursor !== null; cursor = parent.get(cursor) ?? null) {
          path.push(cursor);
        }

        return [...path.toReversed(), start];
      }

      if (!parent.has(target)) {
        parent.set(target, node);
        queue.push(target);
      }
    }
  }

  return [start];
}
