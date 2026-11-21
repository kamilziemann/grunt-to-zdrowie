import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError } from './auth-error';

const mocks = vi.hoisted(() => {
  const client = {
    signIn: { email: vi.fn<(input: unknown) => Promise<{ error: unknown }>>() },
    signUp: { email: vi.fn<(input: unknown) => Promise<{ error: unknown }>>() },
    signOut: vi.fn<() => Promise<{ error: unknown }>>(),
  };

  return {
    client,
    create: vi.fn<(options: unknown) => typeof client>(() => client),
    loaded: vi.fn<() => void>(),
  };
});

// `loaded` = moment zaladowania paczki Better Auth (statyczny import ladowalby ja razem z modulem).
vi.mock('better-auth/react', () => {
  mocks.loaded();

  return { createAuthClient: mocks.create };
});

// Modul trzyma klienta w pamieci, wiec kazdy test laduje go od nowa (stan „przed pierwszym logowaniem”).
async function loadApi() {
  vi.resetModules();

  return import('./auth.api');
}

const CREDENTIALS = { email: 'ala@example.com', password: 'tajne-haslo-123' };

describe('auth.api', () => {
  beforeEach(() => {
    mocks.create.mockClear();
    mocks.loaded.mockClear();
    mocks.client.signIn.email.mockReset().mockResolvedValue({ error: null });
    mocks.client.signUp.email.mockReset().mockResolvedValue({ error: null });
    mocks.client.signOut.mockReset().mockResolvedValue({ error: null });
  });

  it('ładuje Better Auth i tworzy klienta dopiero przy pierwszej akcji, tylko raz', async () => {
    const api = await loadApi();

    expect(mocks.loaded).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();

    await api.signInWithEmail(CREDENTIALS);
    await api.signOutUser();

    expect(mocks.loaded).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({ basePath: '/api/auth' });
    expect(mocks.client.signIn.email).toHaveBeenCalledWith(CREDENTIALS);
    expect(mocks.client.signOut).toHaveBeenCalledTimes(1);
  });

  it('rejestracja przekazuje imię, e-mail i hasło', async () => {
    const api = await loadApi();

    await api.signUpWithEmail({ name: 'Ala', ...CREDENTIALS });

    expect(mocks.client.signUp.email).toHaveBeenCalledWith({ name: 'Ala', ...CREDENTIALS });
  });

  it('błąd z odpowiedzi Better Auth to AuthError z rodzajem', async () => {
    const api = await loadApi();

    mocks.client.signIn.email.mockResolvedValue({
      error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' },
    });

    await expect(api.signInWithEmail(CREDENTIALS)).rejects.toEqual(new AuthError('invalidCredentials'));
  });

  it('wyjątek wywołania to błąd sieci', async () => {
    const api = await loadApi();

    mocks.client.signOut.mockRejectedValue(new TypeError('fetch failed'));

    await expect(api.signOutUser()).rejects.toMatchObject({ kind: 'network' });
  });

  it('nieudane utworzenie klienta to błąd sieci, a kolejna próba tworzy go od nowa', async () => {
    const api = await loadApi();

    mocks.create.mockImplementationOnce(() => {
      throw new TypeError('Failed to fetch dynamically imported module');
    });

    await expect(api.signOutUser()).rejects.toMatchObject({ kind: 'network' });

    await api.signOutUser();

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.client.signOut).toHaveBeenCalledTimes(1);
  });
});
