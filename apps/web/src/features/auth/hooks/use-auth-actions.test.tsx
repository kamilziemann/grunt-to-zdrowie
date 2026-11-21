import type * as AuthQueries from '../api/auth.queries';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import type { Me } from '@app/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';

import { useSignIn, useSignOut } from './use-auth-actions';
import { useMe } from './use-me';

const apiMock = vi.hoisted(() => ({
  fetchMe: vi.fn<() => Promise<Me>>(),
  signInWithEmail: vi.fn<(input: unknown) => Promise<void>>(),
  signUpWithEmail: vi.fn<(input: unknown) => Promise<void>>(),
  signOutUser: vi.fn<() => Promise<void>>(),
}));

vi.mock('../api/auth.api', () => apiMock);
// GET /me idzie przez klienta API (getApi) - w tescie zapytanie dostaje funkcje z mocka.
vi.mock('../api/auth.queries', async () => ({
  ...(await vi.importActual<typeof AuthQueries>('../api/auth.queries')),
  meQuery: () => queryOptions({ queryKey: queryKeys.auth.me(), queryFn: apiMock.fetchMe }),
}));

const ANONYMOUS: Me = { authEnabled: true, authenticated: false, user: null };
const SIGNED_IN: Me = {
  authEnabled: true,
  authenticated: true,
  user: { id: 'usr_1', email: 'ola@example.com', roles: ['user'] },
};
const CREDENTIALS = { email: 'ola@example.com', password: 'tajne-haslo-1' };

function setup() {
  // staleTime jak w aplikacji (lib/query/query-client): dane z loadera sa swieze, bez dodatkowego GET /me.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

describe('useMe', () => {
  beforeEach(() => apiMock.fetchMe.mockReset());

  it('tozsamosc z cache (loader trasy chronionej) od razu, bez stanu ladowania i bez zapytania', () => {
    const { client, wrapper } = setup();

    client.setQueryData(queryKeys.auth.me(), ANONYMOUS);
    const { result } = renderHook(() => useMe(), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual(ANONYMOUS);
    expect(apiMock.fetchMe).not.toHaveBeenCalled();
  });

  it('bez danych z loadera pobiera GET /me', async () => {
    const { wrapper } = setup();

    apiMock.fetchMe.mockResolvedValue(SIGNED_IN);

    const { result } = renderHook(() => useMe(), { wrapper });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(SIGNED_IN));
  });
});

describe('useSignIn / useSignOut', () => {
  beforeEach(() => {
    apiMock.fetchMe.mockReset();
    apiMock.signInWithEmail.mockReset();
    apiMock.signOutUser.mockReset();
  });

  it('po zalogowaniu tozsamosc w cache jest odswiezana', async () => {
    const { client, wrapper } = setup();

    apiMock.signInWithEmail.mockResolvedValue();
    apiMock.fetchMe.mockResolvedValue(SIGNED_IN);

    client.setQueryData(queryKeys.auth.me(), ANONYMOUS);
    const { result } = renderHook(() => ({ me: useMe(), signIn: useSignIn() }), { wrapper });

    await act(() => result.current.signIn.mutateAsync(CREDENTIALS));

    expect(apiMock.signInWithEmail).toHaveBeenCalledWith(CREDENTIALS);
    await waitFor(() => expect(result.current.me.data).toEqual(SIGNED_IN));
  });

  it('nieudane logowanie zostawia tozsamosc bez zmian i zwraca blad', async () => {
    const { client, wrapper } = setup();
    const failure = new Error('invalid_credentials');

    apiMock.signInWithEmail.mockRejectedValue(failure);

    client.setQueryData(queryKeys.auth.me(), ANONYMOUS);
    const { result } = renderHook(() => ({ me: useMe(), signIn: useSignIn() }), { wrapper });

    await act(() => result.current.signIn.mutateAsync(CREDENTIALS).catch(() => undefined));

    await waitFor(() => expect(result.current.signIn.error).toBe(failure));
    expect(client.getQueryState(queryKeys.auth.me())?.isInvalidated).toBe(false);
    expect(apiMock.fetchMe).not.toHaveBeenCalled();
  });

  it('po wylogowaniu tozsamosc wraca do anonimowej', async () => {
    const { client, wrapper } = setup();

    apiMock.signOutUser.mockResolvedValue();
    apiMock.fetchMe.mockResolvedValue(ANONYMOUS);

    client.setQueryData(queryKeys.auth.me(), SIGNED_IN);
    const { result } = renderHook(() => ({ me: useMe(), signOut: useSignOut() }), { wrapper });

    await act(() => result.current.signOut.mutateAsync());

    await waitFor(() => expect(result.current.me.data).toEqual(ANONYMOUS));
  });
});
