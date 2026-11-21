// Fabryka klienta: jeden `Db` na request (D1 binding jest per request; nie trzymamy polaczen miedzy requestami).
// Transakcje: D1 nie ma interaktywnych transakcji - uzywaj `db.batch([...])` (atomowe wykonanie wielu zapytan).
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

export { schema };
