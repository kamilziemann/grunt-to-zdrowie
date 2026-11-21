// Mapa cache'u brzegowego API w jednym miejscu: ktore odczyty sa publiczne (polityka + tagi z @app/cache) i ktore
// mutacje czyszcza ktore tagi. Wszystko, czego tu nie ma, jest `private, no-store` (privateByDefault).
// Purge jest zgrubny i bezpieczny: zmiana czysci cala rodzine danych, bo przeliczenie stron jest tanie, a pominiety
// tag = nieaktualna strona. Strony Start uzywaja tych samych tagow (apps/web).
import { cacheTags } from '@app/cache';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { AppEnv } from '../../services/container';
import { privateByDefault, publicCache, purgeOnWrite } from '../middlewares';
import { HYDRO_PATH, PARCELS_PATH, PLACES_PATH } from './paths';

/** Publiczne odczyty z polityka i tagami. */
const PUBLIC_READS: [
  path: string,
  policy: 'editorial' | 'publicData',
  tags: (c: Context<AppEnv>) => string[],
][] = [
  // Dzialki zmieniaja sie rzadko, a ULDK ma limit zapytan na IP - odczyty ida z brzegu.
  [`${PARCELS_PATH}/*`, 'publicData', () => [cacheTags.parcels()]],
  // Geokoder publiczny ma limit ok. 1 zapytania/s - te same pytania ida z brzegu.
  [`${PLACES_PATH}/*`, 'publicData', () => [cacheTags.places()]],
  // Hydrografia zmienia sie tylko po ponownym imporcie BDOT10k; kafle maja stale adresy, wiec ida z brzegu.
  [`${HYDRO_PATH}/*`, 'publicData', () => [cacheTags.hydro()]],
  // Obraz pola z satelity (tryb 3D): dla przeszlego dnia sie nie zmienia, a kazde liczenie to kilka zapytan do
  // Copernicus z limitem; zalezy od granic dzialek, wiec czysci go ten sam tag co dzialki.
  ['/imagery/*', 'publicData', () => [cacheTags.parcels()]],
];

/**
 * Mutacje, ktore zmieniaja to, co widzi anonimowy odczyt: prefiks trasy -> tagi do wyczyszczenia. Dzis pusto - API
 * tylko czyta zrodla zewnetrzne, a analiza (POST) niczego publicznego nie zapisuje.
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
