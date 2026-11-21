// Wywolania auth w przegladarce. Klient Better Auth rozmawia z originem aplikacji (`/api/auth/*`, proxy do API), wiec
// ciasteczko sesji jest first-party. Tozsamosc (`/me`) czyta `meQuery` (auth.queries) przez `/api/me`, nie z klienta Better Auth,
// zeby zrodlem prawdy o sesji i fladze `authEnabled` bylo jedno API (`GET /me`).
import type { SignInInput, SignUpInput } from '@app/contracts';
import type { createAuthClient } from 'better-auth/react';

import { AuthError, classifyAuthError, type RawAuthError } from './auth-error';

type AuthClient = ReturnType<typeof createAuthClient>;

let client: Promise<AuthClient> | undefined;

/**
 * Klient tworzony leniwie (tylko w przegladarce, w handlerach zdarzen): baseURL = origin biezacej strony. Better Auth
 * laduje sie dopiero przy pierwszym logowaniu, rejestracji albo wylogowaniu, wiec nie wchodzi do JS kazdej strony
 * aplikacji (menu konta w naglowku). Nieudane ladowanie nie zostaje w pamieci - kolejna proba importuje ponownie.
 */
function authClient(): Promise<AuthClient> {
  client ??= import('better-auth/react')
    .then(({ createAuthClient: create }) => create({ basePath: '/api/auth' }))
    .catch((cause: unknown) => {
      client = undefined;

      throw cause;
    });

  return client;
}

interface AuthResult {
  error: RawAuthError | null;
}

async function run(call: (auth: AuthClient) => Promise<AuthResult>): Promise<void> {
  let result: AuthResult;

  try {
    result = await call(await authClient());
  } catch (cause) {
    throw new AuthError('network', { cause });
  }

  if (result.error) throw new AuthError(classifyAuthError(result.error));
}

export function signInWithEmail(input: SignInInput): Promise<void> {
  return run((auth) => auth.signIn.email({ email: input.email, password: input.password }));
}

export function signUpWithEmail(input: SignUpInput): Promise<void> {
  return run((auth) => auth.signUp.email({ name: input.name, email: input.email, password: input.password }));
}

export function signOutUser(): Promise<void> {
  return run((auth) => auth.signOut());
}
