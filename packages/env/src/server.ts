// Srodowisko Workera API. `vars` z wrangler.jsonc + sekrety (wrangler secret / .dev.vars) sa walidowane na starcie requestu.
// Bindingi (D1, R2, Queues...) sa typowane osobno - nie da sie ich walidowac Zod-em.
import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import { z } from 'zod';

import { ENVIRONMENTS, optionalSecret, parseEnv } from './shared';

/** Minimalna dlugosc AUTH_SECRET (zalecenie Better Auth: losowe 32+ znaki, np. `openssl rand -base64 32`). */
export const AUTH_SECRET_MIN_LENGTH = 32;

export const serverVarsSchema = z
  .object({
    /**
     * development | preview | production - zawsze jawnie w vars (wrangler.jsonc kazdego env). Bez wartosci domyslnej:
     * brak nie moze po cichu wlaczyc zachowan lokalnych (straznicy bez auth, tresc bledow 500).
     */
    ENVIRONMENT: z.enum(ENVIRONMENTS),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
    /** publiczny adres Workera API (linki w OpenAPI, odpowiedziach) */
    PUBLIC_URL: z.url(),
    /** dodatkowe originy (CORS) - lista po przecinku; pusta = tylko PUBLIC_URL */
    ALLOWED_ORIGINS: z.string().default(''),
    /** uwierzytelnianie (Better Auth, @app/auth): "true"/"false"; domyslnie wylaczone */
    AUTH_ENABLED: z.stringbool().default(false),
    /** sekret podpisujacy sesje i ciasteczka (min. 32 znaki); wymagany, gdy AUTH_ENABLED=true: `wrangler secret put` */
    AUTH_SECRET: optionalSecret,
    /** publiczny adres, pod ktorym dziala /auth/* (baseURL Better Auth); pusty = PUBLIC_URL */
    AUTH_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    /**
     * Postgres (Neon, z PostGIS) - adres pooled z `neon env pull` (.env.local); opcjonalny; konta i sesje zostaja w D1.
     * Lokalnie: apps/web/.dev.vars, w chmurze: `wrangler secret put DATABASE_URL`.
     */
    DATABASE_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string')
        .optional(),
    ),
    /**
     * Klient OAuth Copernicus Data Space (API statystyk Sentinel-2: NDVI/NDMI pola). Opcjonalny - bez niego zrodlo
     * satelitarne zglasza brak danych. Lokalnie: apps/web/.dev.vars, w chmurze: `wrangler secret put`.
     */
    COPERNICUS_CLIENT_ID: optionalSecret,
    COPERNICUS_CLIENT_SECRET: optionalSecret,
  })
  .superRefine((vars, ctx) => {
    if (!vars.AUTH_ENABLED) return;

    if (vars.AUTH_SECRET === undefined || vars.AUTH_SECRET.length < AUTH_SECRET_MIN_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: `required when AUTH_ENABLED=true (min. ${AUTH_SECRET_MIN_LENGTH} characters; wrangler secret put AUTH_SECRET)`,
      });
    }
  });

export type ServerVars = z.infer<typeof serverVarsSchema>;

/**
 * Bindingi z wrangler.jsonc. Nowy binding (R2, KV, Queue, Workflow, Durable Object): dopisz go tutaj, w `pickBindings`
 * i w wrangler.jsonc (kazde `env` ma pelna kopie bindingow); adapter w apps/server/src/infrastructure.
 */
export interface ServerBindings {
  DB: D1Database;
  ASSETS?: Fetcher;
}

/** Surowe env Workera: bindingi + vars jako stringi. */
export type RawServerEnv = ServerBindings & Record<string, unknown>;

export function parseServerVars(raw: Record<string, unknown>): ServerVars {
  return parseEnv('server', serverVarsSchema, raw);
}

export function pickBindings(raw: RawServerEnv): ServerBindings {
  return {
    DB: raw.DB,
    ASSETS: raw.ASSETS,
  };
}

/**
 * Sentry (opcjonalny, domyslnie WYLACZONY): bledy 5xx i nieobsluzone wyjatki Workera. Logi i slady daje Cloudflare
 * Observability (wrangler.jsonc) - Sentry wlaczasz tylko, gdy potrzebujesz alertow/grupowania issue poza Cloudflare.
 */
export const sentryConfigSchema = z
  .object({
    SENTRY_ENABLED: z.stringbool().default(false),
    SENTRY_DSN: optionalSecret,
    SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : Number(v)),
      z.number().min(0).max(1).default(0),
    ),
    ENVIRONMENT: z.enum(ENVIRONMENTS).default('development'),
  })
  .refine((v) => !v.SENTRY_ENABLED || v.SENTRY_DSN !== undefined, {
    message: 'SENTRY_DSN is required when SENTRY_ENABLED=true',
    path: ['SENTRY_DSN'],
  });

export type SentryConfig = z.infer<typeof sentryConfigSchema>;

export function parseSentryConfig(raw: Record<string, unknown>): SentryConfig {
  return parseEnv('sentry', sentryConfigSchema, raw);
}
