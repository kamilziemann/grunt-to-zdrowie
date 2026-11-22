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
    });
  });

  it('zglasza czytelny blad z lista pol', () => {
    const run = () => parseServerVars({ PUBLIC_URL: 'nope', ENVIRONMENT: 'staging' });

    expect(run).toThrow(EnvError);
    expect(run).toThrow(/PUBLIC_URL/);
    expect(run).toThrow(/ENVIRONMENT/);
  });

  it('ENVIRONMENT jest wymagane: brak nie oznacza po cichu development (tresc bledow)', () => {
    const run = () => parseServerVars({ PUBLIC_URL: 'http://localhost:8787' });

    expect(run).toThrow(EnvError);
    expect(run).toThrow(/ENVIRONMENT/);
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
