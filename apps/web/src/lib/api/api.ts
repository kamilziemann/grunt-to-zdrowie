// Jedyny klient API aplikacji (Hono RPC typowany z AppType serwera). Izomorficzny (@app/start-kit): w loaderach przy
// SSR woła Hono w tym samym Workerze (bez sieci), w przegladarce `fetch('/api')` z tym samym originem - ciasteczko
// sesji idzie samo, bez CORS i bez adresu API w buildzie. Uzycie: `getApi().articles.$get(...)` w queryOptions
// (features/<x>/api/*.queries.ts) i mutacjach.
import { createRpcClient } from '@app/rpc';
import { createIsomorphicApi } from '@app/start-kit';

import type { AppType } from '../rpc/app-type';

export const API_PREFIX = '/api';

export const getApi = createIsomorphicApi(
  (baseUrl, options) => createRpcClient<AppType>(baseUrl, options),
  API_PREFIX,
);

export type Api = ReturnType<typeof getApi>;

/**
 * Adres zasobu API spoza RPC (obraz, plik do pobrania, surowy dokument) do `<img src>` i linkow - wzgledny, ten sam
 * origin. Puste wartosci query sa pomijane.
 */
export function apiUrl(path: string, query?: Record<string, string | number | undefined>): `/api/${string}` {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }

  const search = params.toString();

  const relative = path.startsWith('/') ? path.slice(1) : path;

  return `/api/${relative}${search ? `?${search}` : ''}`;
}
