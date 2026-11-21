import { schema } from '@fx/db';
import { drizzle } from 'drizzle-orm/d1';

import type { JobRepository } from '../domain/ports';

export const createDb = (): JobRepository => ({ all: () => [] });

export async function lazy(): Promise<unknown> {
  const mod = await import('./lazy');
  return mod.lazyValue(schema, drizzle);
}
