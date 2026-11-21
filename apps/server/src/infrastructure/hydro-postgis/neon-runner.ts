// SqlRunner na sterowniku Neon w trybie HTTP (`neon()` z @neondatabase/serverless): jedno wywolanie fetch na
// transakcje, bez gniazd TCP, wiec dziala w workerd. Polaczenie nie jest trzymane miedzy requestami.
import { neon } from '@neondatabase/serverless';

import type { SqlRunner } from './hydro-postgis';

export function createNeonSqlRunner(databaseUrl: string): SqlRunner {
  const sql = neon(databaseUrl);

  return async (queries, signal) =>
    (await sql.transaction(
      queries.map((query) => sql.query(query.text, query.params)),
      { readOnly: true, fetchOptions: { signal } },
    )) as Record<string, unknown>[][];
}
