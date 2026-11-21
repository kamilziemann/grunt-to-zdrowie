// Mapa cache'u brzegowego API w jednym miejscu: ktore odczyty sa publiczne (polityka + tagi z @app/cache) i ktore
// mutacje czyszcza ktore tagi. Wszystko, czego tu nie ma, jest `private, no-store` (privateByDefault).
// Purge jest zgrubny i bezpieczny: zmiana czysci cala rodzine danych, bo przeliczenie stron jest tanie, a pominiety
// tag = nieaktualna strona. Strony Start uzywaja tych samych tagow (apps/web).
import { cacheTags } from '@app/cache';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { AppEnv } from '../../services/container';
import { privateByDefault, publicCache, purgeOnWrite } from '../middlewares';
import { PARCELS_PATH } from './paths';

/** Publiczne odczyty z polityka i tagami. */
const PUBLIC_READS: [
  path: string,
  policy: 'editorial' | 'publicData',
  tags: (c: Context<AppEnv>) => string[],
][] = [
  // Dzialki zmieniaja sie rzadko, a ULDK ma limit zapytan na IP - odczyty ida z brzegu.
  [`${PARCELS_PATH}/*`, 'publicData', () => [cacheTags.parcels()]],
];

/**
 * Mutacje, ktore zmieniaja to, co widzi anonimowy odczyt: prefiks trasy -> tagi do wyczyszczenia. Dzis pusto - API
 * tylko czyta zrodla zewnetrzne.
 */
const PURGES: [prefix: string, tags: string[]][] = [];

export function mountCacheRules(app: OpenAPIHono<AppEnv>): void {
  app.use('*', privateByDefault);

  for (const [path, policy, tags] of PUBLIC_READS) app.use(path, publicCache(policy, tags));

  for (const [prefix, tags] of PURGES) {
    app.use(prefix, purgeOnWrite(tags));
    app.use(`${prefix}/*`, purgeOnWrite(tags));
  }
}
