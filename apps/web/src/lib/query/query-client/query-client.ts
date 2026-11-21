// Fabryka QueryClient: osobny klient na kazde renderowanie serwerowe, jeden wspolny w przegladarce.
import { QueryClient } from '@tanstack/react-query';
import { isRpcError } from '@app/rpc';

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 409, 413, 415, 422]);

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isRpcError(error) && NO_RETRY_STATUSES.has(error.status)) return false;

          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();

  return browserQueryClient;
}
