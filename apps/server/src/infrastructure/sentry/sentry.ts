// Adapter Sentry dla Workera (@sentry/cloudflare). Domyslnie wylaczony: bez SENTRY_ENABLED=true i SENTRY_DSN
// `withSentry` dostaje `enabled: false` i nic nie wysyla. Konfiguracja czytana per wywolanie (bez I/O przy imporcie).
import { parseSentryConfig } from '@app/env/server';
import { captureException, type CloudflareOptions } from '@sentry/cloudflare';

/** Opcje dla `withSentry` - zla konfiguracja nie wywraca Workera, tylko wylacza Sentry. */
export function sentryOptions(env: Record<string, unknown>): CloudflareOptions {
  try {
    const config = parseSentryConfig(env);

    return {
      enabled: config.SENTRY_ENABLED,
      dsn: config.SENTRY_DSN,
      environment: config.ENVIRONMENT,
      tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
    };
  } catch {
    return { enabled: false };
  }
}

/** Raport bledu 5xx z kontekstem korelacji (requestId/traceId jak w logach Cloudflare). */
export function reportToSentry(
  err: unknown,
  context: { requestId?: string; traceId?: string; path: string },
): void {
  captureException(err, {
    tags: { requestId: context.requestId, traceId: context.traceId, path: context.path },
  });
}
