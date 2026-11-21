// Tozsamosc biezacego uzytkownika (`GET /me`) jako zapytanie TanStack Query i jej sprowadzenie do czterech stanow,
// na ktorych opieraja sie strony i ochrona tras (`beforeLoad` tras chronionych). `/me` jest prywatne (no-store), wiec
// strony publiczne nie pytaja o nie w SSR - menu konta ustala je w przegladarce, a HTML zostaje wspolny dla CDN.
import type { Me, ProblemDetails } from '@app/contracts';
import { unwrap } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';
import { toProblem } from '@/lib/problems';

export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.auth.me(),
    queryFn: (): Promise<Me> => unwrap<Me>(getApi().me.$get()),
    // tozsamosc zmienia sie tylko po logowaniu/wylogowaniu (mutacje uniewazniaja klucz)
    staleTime: 60_000,
  });

export type AuthState =
  /** AUTH_ENABLED=false w API: aplikacja dziala bez kont */
  | { kind: 'disabled' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; me: Me & { user: NonNullable<Me['user']> } }
  /** nie udalo sie ustalic stanu (API niedostepne): ochrona tras zamyka sie, zamiast przepuszczac */
  | { kind: 'error'; problem: ProblemDetails };

export function toAuthState(me: Me): AuthState {
  if (!me.authEnabled) return { kind: 'disabled' };

  if (me.authenticated && me.user) return { kind: 'authenticated', me: { ...me, user: me.user } };

  return { kind: 'anonymous' };
}

/** Stan auth dla `beforeLoad`: blad API = stan `error` (nigdy wyjatek), zeby trasa mogla zdecydowac sama. */
export async function resolveAuthState(fetchMe: () => Promise<Me>): Promise<AuthState> {
  try {
    return toAuthState(await fetchMe());
  } catch (error) {
    return { kind: 'error', problem: toProblem(error) };
  }
}
