import { z, type ZodError, type ZodType } from 'zod';

export const ENVIRONMENTS = ['development', 'preview', 'production'] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

export class EnvError extends Error {
  constructor(scope: string, error: ZodError) {
    const lines = error.issues.map((i) => `  - ${i.path.map(String).join('.') || '(root)'}: ${i.message}`);

    super(
      `Invalid ${scope} environment:\n${lines.join('\n')}\nSee .env.example / .dev.vars.example for the expected variables.`,
    );
    this.name = 'EnvError';
  }
}

export function parseEnv<T>(scope: string, schema: ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);

  if (!result.success) throw new EnvError(scope, result.error);

  return result.data;
}

/** Opcjonalny sekret: pusty string (np. `KLUCZ=` w .dev.vars) traktujemy jak brak wartosci. */
export const optionalSecret = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());
