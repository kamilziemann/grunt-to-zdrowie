// Konfiguracja Better Auth bez bazy: limit zapytan musi byc wlaczony niezaleznie od NODE_ENV (vitest ustawia
// NODE_ENV=test, Workers nie ustawiaja go wcale - w obu przypadkach domyslny limiter Better Auth bylby wylaczony).
// Zachowanie na prawdziwej D1 (429, liczniki w tabeli) sprawdza apps/server/test/integration/auth.test.ts.
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '@app/db';
import { describe, expect, it } from 'vitest';

import { AUTH_BASE_PATH, AUTH_RATE_LIMIT, createAuth } from './auth';

// Better Auth nie dotyka bazy przy budowie kontekstu, wiec wystarczy pusty binding.
const auth = createAuth(createDb({} as unknown as D1Database), {
  secret: 'test-secret-test-secret-test-secret-0123456789',
  baseUrl: 'http://localhost:8787',
});

describe('createAuth: limit zapytan', () => {
  it('jest wlaczony jawnie i liczy w bazie (nie w pamieci isolatu)', async () => {
    const context = await auth.$context;

    expect(context.rateLimit).toMatchObject({ enabled: true, storage: 'database' });
    expect(context.options.rateLimit).toEqual(AUTH_RATE_LIMIT);
  });

  it('logowanie i rejestracja maja wlasne, ciasne okna', () => {
    expect(AUTH_RATE_LIMIT.customRules['/sign-in/email']).toEqual({ window: 60, max: 5 });
    expect(AUTH_RATE_LIMIT.customRules['/sign-up/email']).toEqual({ window: 3600, max: 10 });
  });

  it('sciezki regul sa wzgledne wobec AUTH_BASE_PATH (tak je dopasowuje Better Auth)', () => {
    for (const path of Object.keys(AUTH_RATE_LIMIT.customRules)) {
      expect(path.startsWith(AUTH_BASE_PATH)).toBe(false);
      expect(path.startsWith('/')).toBe(true);
    }
  });
});
