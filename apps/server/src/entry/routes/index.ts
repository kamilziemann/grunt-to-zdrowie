// Montaz modulow pod sciezkami. Jeden lancuch wywolan, zeby typ aplikacji (AppType dla hono/client) zawieral
// wszystkie trasy. Nowy modul = jedna linia `.route('/sciezka', modul)`.
import type { OpenAPIHono } from '@hono/zod-openapi';

import { analysisModule } from '../../modules/analysis';
import { contextModule } from '../../modules/context';
import { healthModule } from '../../modules/health';
import { hydroModule } from '../../modules/hydro';
import { imageryModule } from '../../modules/imagery';
import { parcelsModule } from '../../modules/parcels';
import { placesModule } from '../../modules/places';
import { reportsModule } from '../../modules/reports';
import { telemetryModule } from '../../modules/telemetry';
import type { AppEnv } from '../../services/container';
import { mountCacheRules } from './cache-rules';

export * from './paths';

export function mountRoutes(app: OpenAPIHono<AppEnv>) {
  // Cache brzegowy przed modulami: polityki publicznych odczytow i purge po mutacjach. API jest publiczne
  // (aplikacja bez kont, ADR 0011).
  mountCacheRules(app);

  return app
    .route('/health', healthModule)
    .route('/telemetry', telemetryModule)
    .route('/parcels', parcelsModule)
    .route('/places', placesModule)
    .route('/hydro', hydroModule)
    .route('/context', contextModule)
    .route('/analysis', analysisModule)
    .route('/reports', reportsModule)
    .route('/imagery', imageryModule);
}
