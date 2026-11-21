// Auth opcjonalne: wylaczone domyslnie (503 pod /auth/*, /me mowi authEnabled=false, reszta API dziala bez zmian) oraz
// wlaczone konfiguracja (AUTH_ENABLED + AUTH_SECRET): rejestracja i logowanie emailem/haslem, cookie -> /me, straznik 401.
import { beforeAll, describe, expect, it } from 'vitest';

import { requireAuth, requirePolicy } from '../../src/entry/middlewares';
import { hasAnyRole } from '../../src/domain/authorization';
import { json, makeApp, testEnv } from '../helpers';

const SECRET = 'test-secret-test-secret-test-secret-0123456789';
const enabledEnv = { AUTH_ENABLED: 'true', AUTH_SECRET: SECRET };

interface MeBody {
  authEnabled: boolean;
  authenticated: boolean;
  user: { id: string; email: string; roles: string[] } | null;
}

/** Ciasteczka z odpowiedzi (Set-Cookie) w formie naglowka Cookie. */
function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

function protectedApp(extraEnv: Record<string, unknown>) {
  return makeApp({}, extraEnv, (app) => {
    app.get('/test-protected', requireAuth(), (c) => c.json({ ok: true }));
    app.get('/test-admin', requirePolicy(hasAnyRole('admin')), (c) => c.json({ ok: true }));
  });
}

describe('auth wylaczone (domyslnie)', () => {
  const app = makeApp();

  it('/auth/* odpowiada 503 not_configured jako problem+json', async () => {
    const res = await app.request('/auth/get-session');

    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'not_configured' });
    expect((await app.request('/auth/sign-in/email', json({ email: 'a@b.pl', password: 'x' }))).status).toBe(
      503,
    );
  });

  it('/me mowi authEnabled=false i brak uzytkownika', async () => {
    const res = await app.request('/me');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authEnabled: false, authenticated: false, user: null });
  });

  it('publiczne API dziala bez kont, a requireAuth przepuszcza', async () => {
    const open = makeApp({ placeSource: { search: () => Promise.resolve([]) } });

    expect((await app.request('/health')).status).toBe(200);
    expect((await open.request('/places/search?q=Milicz')).status).toBe(200);

    const guarded = protectedApp({});

    expect((await guarded.request('/test-protected')).status).toBe(200);
    expect((await guarded.request('/test-admin')).status).toBe(200);
  });
});

describe('auth wlaczone', () => {
  const app = protectedApp(enabledEnv);
  const rolesOf = async (cookie: string) =>
    (await (await app.request('/me', { headers: { cookie } })).json<MeBody>()).user?.roles;
  const credentials = { name: 'Ala', email: 'ala@example.com', password: 'Haslo-Testowe-123' };

  // Konto zakladamy raz (D1 w pamieci jest wspolne dla testow tego pliku, ktore biegna po kolei).
  beforeAll(async () => {
    const res = await app.request('/auth/sign-up/email', json(credentials));

    if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  });

  it('logowanie emailem i haslem, cookie daje /me authenticated', async () => {
    const signIn = await app.request(
      '/auth/sign-in/email',
      json({ email: credentials.email, password: credentials.password }),
    );

    expect(signIn.status).toBe(200);

    const cookie = cookieFrom(signIn);

    expect(cookie).toContain('better-auth.session_token');

    const me = await app.request('/me', { headers: { cookie } });
    const body = (await me.json()) as MeBody;

    expect(body).toEqual({
      authEnabled: true,
      authenticated: true,
      user: { id: expect.any(String), email: credentials.email, roles: [] },
    });
  });

  it('zle haslo = 401 i brak sesji', async () => {
    const res = await app.request(
      '/auth/sign-in/email',
      json({ email: credentials.email, password: 'zle-haslo-123' }),
    );

    expect(res.status).toBe(401);
    expect(cookieFrom(res)).not.toContain('session_token');
  });

  it('/me bez ciasteczka: authEnabled=true, authenticated=false', async () => {
    expect(await (await app.request('/me')).json()).toEqual({
      authEnabled: true,
      authenticated: false,
      user: null,
    });
  });

  it('requireAuth: 401 unauthorized bez sesji, 200 z sesja; polityka rol: 403 bez roli', async () => {
    const anonymous = await app.request('/test-protected');

    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toMatchObject({ code: 'unauthorized' });

    const cookie = cookieFrom(
      await app.request(
        '/auth/sign-in/email',
        json({ email: credentials.email, password: credentials.password }),
      ),
    );

    expect((await app.request('/test-protected', { headers: { cookie } })).status).toBe(200);

    const forbidden = await app.request('/test-admin', { headers: { cookie } });

    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ code: 'forbidden' });
    expect((await app.request('/test-admin')).status).toBe(401);
  });

  it('role z rekordu uzytkownika trafiaja do tozsamosci (nadaje je backend, nie klient)', async () => {
    const email = 'admin@example.com';
    const res = await app.request(
      '/auth/sign-up/email',
      json({ name: 'Admin', email, password: credentials.password, roles: ['admin'] }),
    );
    const cookie = cookieFrom(res);

    // `roles` z body rejestracji jest ignorowane (input: false) - rola dopiero po zmianie w bazie
    expect(await rolesOf(cookie)).toEqual([]);

    await testEnv().DB.prepare('UPDATE user SET roles = ? WHERE email = ?').bind('["admin"]', email).run();

    expect(await rolesOf(cookie)).toEqual(['admin']);
    expect((await app.request('/test-admin', { headers: { cookie } })).status).toBe(200);
  });

  it('CORS: z auth zwraca allow-credentials dla zaufanego originu', async () => {
    const res = await app.request('/me', { headers: { origin: 'http://localhost:3000' } });

    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(
      (await makeApp().request('/me', { headers: { origin: 'http://localhost:3000' } })).headers.get(
        'access-control-allow-credentials',
      ),
    ).toBeNull();
  });
});

describe('auth wlaczone: limit prob logowania i rejestracji', () => {
  const app = makeApp({}, enabledEnv);
  // Na Cloudflare adres klienta niesie CF-Connecting-IP (proxy aplikacji przekazuje go dalej).
  const from = (ip: string, body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
  const credentials = { name: 'Ola', email: 'ola@example.com', password: 'Haslo-Testowe-123' };

  beforeAll(async () => {
    const res = await app.request('/auth/sign-up/email', from('198.51.100.1', credentials));

    if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  });

  it('logowanie: po 5 probach z jednego IP 429 (takze z dobrym haslem), inne IP liczone osobno', async () => {
    const attacker = '203.0.113.7';
    const wrong = { email: credentials.email, password: 'zle-haslo-123' };
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 5; attempt++) {
      statuses.push((await app.request('/auth/sign-in/email', from(attacker, wrong))).status);
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401]);

    const blocked = await app.request('/auth/sign-in/email', from(attacker, wrong));

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('x-retry-after'))).toBeGreaterThan(0);

    const right = { email: credentials.email, password: credentials.password };

    expect((await app.request('/auth/sign-in/email', from(attacker, right))).status).toBe(429);
    expect((await app.request('/auth/sign-in/email', from('203.0.113.8', right))).status).toBe(200);
  });

  it('liczniki leza w D1 (wspolne dla isolatow), nie w pamieci', async () => {
    const row = await testEnv()
      .DB.prepare('SELECT count FROM rate_limit WHERE key = ?')
      .bind('203.0.113.7|/sign-in/email')
      .first<{ count: number }>();

    expect(row?.count).toBe(5);
  });

  it('rejestracja: 10 prob na godzine z jednego IP, potem 429', async () => {
    const ip = '203.0.113.9';
    // Za krotkie haslo: odrzucone (400) bez haszowania, ale proba i tak sie liczy.
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 10; attempt++) {
      statuses.push(
        (
          await app.request(
            '/auth/sign-up/email',
            from(ip, { name: 'Bot', email: `bot${attempt}@example.com`, password: 'x' }),
          )
        ).status,
      );
    }

    expect(statuses.every((status) => status === 400)).toBe(true);
    expect(
      (await app.request('/auth/sign-up/email', from(ip, { ...credentials, email: 'nowy@example.com' })))
        .status,
    ).toBe(429);
  });
});

describe('auth wlaczone bez sekretu', () => {
  it('503 not_configured z nazwa AUTH_SECRET (walidacja srodowiska)', async () => {
    const res = await makeApp({}, { AUTH_ENABLED: 'true' }).request('/me');

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: 'not_configured',
      detail: expect.stringContaining('AUTH_SECRET'),
    });
  });
});
