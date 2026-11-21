// Montaz modulow pod sciezkami. Jeden lancuch wywolan, zeby typ aplikacji (AppType dla hono/client) zawieral
// wszystkie trasy. Nowy modul = jedna linia `.route('/sciezka', modul)`.
import type { OpenAPIHono } from '@hono/zod-openapi';

import { analysisModule } from '../../modules/analysis';
import { contextModule } from '../../modules/context';
import { healthModule } from '../../modules/health';
import { hydroModule } from '../../modules/hydro';
import { imageryModule } from '../../modules/imagery';
import { meModule } from '../../modules/me';
import { parcelsModule } from '../../modules/parcels';
import { placesModule } from '../../modules/places';
import { reportsModule } from '../../modules/reports';
import { telemetryModule } from '../../modules/telemetry';
import type { AppEnv } from '../../services/container';
import { mountCacheRules } from './cache-rules';

export * from './paths';

export function mountRoutes(app: OpenAPIHono<AppEnv>) {
  // Cache brzegowy przed straznikami i modulami: polityki publicznych odczytow i purge po mutacjach.
  mountCacheRules(app);

  // Domyslnie wszystko jest publiczne (auth jest opcjonalne i wylaczone). Ochrona modulu to jedna linia PRZED
  // jego zamontowaniem; przy AUTH_ENABLED=false straznik przepuszcza, wiec API dziala bez kont:
  //   app.use('/x/*', requireAuth());                       // wymaga zalogowania (401 bez sesji)
  //   app.use('/x/*', requirePolicy(hasAnyRole('admin')));  // wymaga polityki (401 / 403)
  // (import `requireAuth`/`requirePolicy` z '../middlewares', polityki z '../../domain/authorization').

  return app
    .route('/health', healthModule)
    .route('/telemetry', telemetryModule)
    .route('/me', meModule)
    .route('/parcels', parcelsModule)
    .route('/places', placesModule)
    .route('/hydro', hydroModule)
    .route('/context', contextModule)
    .route('/analysis', analysisModule)
    .route('/reports', reportsModule)
    .route('/imagery', imageryModule);
}
