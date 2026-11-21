// Domyslne ustawienia TanStack Query dla aplikacji Start: QueryClient tworzony PER ZAPYTANIE w fabryce routera
// (wspolny klient na serwerze przeciekalby dane miedzy uzytkownikami). Bledy 4xx z API nie sa ponawiane (to nie
// przejsciowe awarie), 5xx/siec maksymalnie 2 razy.
import { isRpcError } from '@app/rpc';
import { QueryClient } from '@tanstack/react-query';

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isRpcError(error) && error.status < 500) return false;

  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
