import { describe, expect, it } from 'vitest';

import { sentryOptions } from './sentry';

describe('sentryOptions', () => {
  it('domyslnie wylaczony', () => {
    expect(sentryOptions({}).enabled).toBe(false);
  });

  it('wlaczony z DSN, zla konfiguracja = wylaczony', () => {
    const dsn = 'https://key@o1.ingest.sentry.io/1';

    expect(sentryOptions({ SENTRY_ENABLED: 'true', SENTRY_DSN: dsn })).toMatchObject({ enabled: true, dsn });
    expect(sentryOptions({ SENTRY_ENABLED: 'true' }).enabled).toBe(false);
  });
});
