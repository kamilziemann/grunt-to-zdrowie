import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { EnvError, optionalSecret, parseEnv, parseSentryConfig, parseServerVars } from './index';

/** Minimalne vars lokalnego wrangler dev (ENVIRONMENT jest wymagane, bez domyslnej wartosci). */
const LOCAL = { PUBLIC_URL: 'http://localhost:8787', ENVIRONMENT: 'development' };

describe('parseServerVars', () => {
  it('daje domyslny poziom logow i wartosci opcjonalnych pol', () => {
    const v = parseServerVars(LOCAL);

    expect(v).toEqual({
      ENVIRONMENT: 'development',
      LOG_LEVEL: 'info',
      PUBLIC_URL: 'http://localhost:8787',
      ALLOWED_ORIGINS: '',
      AUTH_ENABLED: false,
    });
  });

  it('zglasza czytelny blad z lista pol', () => {
    const run = () => parseServerVars({ PUBLIC_URL: 'nope', ENVIRONMENT: 'staging' });

    expect(run).toThrow(EnvError);
    expect(run).toThrow(/PUBLIC_URL/);
    expect(run).toThrow(/ENVIRONMENT/);
  });

  it('ENVIRONMENT jest wymagane: brak nie oznacza po cichu development (panel bez auth, tresc bledow)', () => {
    const run = () => parseServerVars({ PUBLIC_URL: 'http://localhost:8787' });

    expect(run).toThrow(EnvError);
    expect(run).toThrow(/ENVIRONMENT/);
  });
});

describe('parseServerVars: auth', () => {
  const base = LOCAL;
  const secret = 'x'.repeat(32);

  it('auth jest domyslnie wylaczone i nie wymaga sekretu', () => {
    expect(parseServerVars(base).AUTH_ENABLED).toBe(false);
    expect(parseServerVars({ ...base, AUTH_ENABLED: 'false' }).AUTH_ENABLED).toBe(false);
  });

  it('AUTH_ENABLED=true bez AUTH_SECRET to blad z nazwa pola', () => {
    const run = () => parseServerVars({ ...base, AUTH_ENABLED: 'true' });

    expect(run).toThrow(EnvError);
    expect(run).toThrow(/AUTH_SECRET: required when AUTH_ENABLED=true/);
  });

  it('pusty albo za krotki sekret przy wlaczonym auth to blad', () => {
    expect(() => parseServerVars({ ...base, AUTH_ENABLED: 'true', AUTH_SECRET: '' })).toThrow(/AUTH_SECRET/);
    expect(() => parseServerVars({ ...base, AUTH_ENABLED: 'true', AUTH_SECRET: 'short' })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it('wlaczone auth z sekretem przechodzi; AUTH_URL jest opcjonalny', () => {
    const v = parseServerVars({ ...base, AUTH_ENABLED: 'true', AUTH_SECRET: secret, AUTH_URL: '' });

    expect(v).toMatchObject({ AUTH_ENABLED: true, AUTH_SECRET: secret });
    expect(v.AUTH_URL).toBeUndefined();
    expect(() => parseServerVars({ ...base, AUTH_URL: 'nope' })).toThrow(/AUTH_URL/);
  });

  it('sekret bez wlaczenia auth jest ignorowany bez bledu', () => {
    expect(parseServerVars({ ...base, AUTH_SECRET: 'short' }).AUTH_ENABLED).toBe(false);
  });
});

describe('optionalSecret', () => {
  it('pusty string = brak wartosci (nie blad)', () => {
    const schema = z.object({ API_KEY: optionalSecret });

    expect(parseEnv('test', schema, { API_KEY: '' }).API_KEY).toBeUndefined();
    expect(parseEnv('test', schema, { API_KEY: 'k' }).API_KEY).toBe('k');
  });
});

describe('parseSentryConfig', () => {
  it('domyslnie wylaczony, bez DSN', () => {
    expect(parseSentryConfig({})).toMatchObject({ SENTRY_ENABLED: false, SENTRY_TRACES_SAMPLE_RATE: 0 });
  });

  it('wlaczony wymaga DSN', () => {
    expect(() => parseSentryConfig({ SENTRY_ENABLED: 'true' })).toThrow(/SENTRY_DSN/);
    expect(
      parseSentryConfig({ SENTRY_ENABLED: 'true', SENTRY_DSN: 'https://k@o.ingest.sentry.io/1' }),
    ).toMatchObject({
      SENTRY_ENABLED: true,
    });
  });
});
