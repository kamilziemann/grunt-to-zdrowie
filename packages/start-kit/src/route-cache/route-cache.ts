// Naglowki cache dla tras TanStack Start (`headers` trasy) z polityk i tagow @app/cache - te same co w API, wiec
// purge po mutacji czysci i strone, i dane, z ktorych powstala. Tagi moga zalezec od danych loadera.
import { cacheHeaders, type CachePolicyName } from '@app/cache';

export function routeCache<TLoaderData = unknown>(
  policy: CachePolicyName,
  tags: (loaderData: TLoaderData | undefined) => readonly string[] = () => [],
) {
  // NoInfer: typ danych loadera wyznacza trasa, nie `headers` (inaczej TS wnioskuje `undefined` i psuje useLoaderData).
  return ({ loaderData }: { loaderData?: NoInfer<TLoaderData> }): Record<string, string> =>
    cacheHeaders(policy, tags(loaderData));
}

/** Odpowiedz bez polityki cache dostaje `private, no-store` - Workers Cache inaczej trzymalby ja 2 h (heurystyka). */
export function withDefaultCacheControl(response: Response, value = 'private, no-store'): Response {
  if (response.headers.has('cache-control')) return response;

  const copy = new Response(response.body, response);

  copy.headers.set('cache-control', value);

  return copy;
}
