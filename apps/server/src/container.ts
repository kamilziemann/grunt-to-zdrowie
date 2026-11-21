// Kompozycja zaleznosci na request (i na wiadomosc kolejki, cron, krok Workflow): repozytoria (Drizzle/D1)
// + infrastruktura (adaptery bindingow i zewnetrznych uslug) -> serwisy. Zadnego I/O na poziomie modulu. `overrides` pozwalaja testom
// podmienic infrastrukture na faki bez dotykania serwisow.
import { nowIso } from '@app/db';

import type { DataSources } from './domain/analysis-ports';
import type { EdgeCachePurger } from './domain/edge-cache';
import type { HydroMapSource } from './domain/hydro-map-source';
import { engineStages } from './domain/engine-stages';
import type { ParcelOutlineSource } from './domain/parcel-outline-source';
import { withFallback, type ParcelSource } from './domain/parcel-source';
import type { PlaceSource } from './domain/place-source';
import { createEdgeCachePurger } from './infrastructure/edge-cache';
import { createEgibWfsOutlineSource, createEgibWfsParcelSource } from './infrastructure/egib-wfs';
import {
  createNeonSqlRunner,
  createPostgisHydroMapSource,
  createPostgisHydroSource,
} from './infrastructure/hydro-postgis';
import { createMetNorwayForecastSource } from './infrastructure/meteo-met-norway';
import { createNasaPowerMeteoSource } from './infrastructure/meteo-nasa-power';
import { createNominatimPlaceSource } from './infrastructure/nominatim';
import { createSampleSources } from './infrastructure/sample-sources';
import { createSentinelStatisticsSource } from './infrastructure/sentinel-statistics';
import { createSoilGridsSource } from './infrastructure/soilgrids';
import { createUldkParcelSource } from './infrastructure/uldk';
import { createAnalysisService } from './services/analysis';
import { createHydroService } from './services/hydro';
import type { Container, ContainerDeps } from './services/container';
import { createParcelsService } from './services/parcels';
import { createPlacesService } from './services/places';

export interface ContainerOverrides {
  /** stały zegar w testach */
  now?: () => string;
  /** czyszczenie cache'u brzegowego (testy: purger zapamietujacy wywolania) */
  edgeCache?: EdgeCachePurger;
  /** zrodlo dzialek (testy: dzialki w pamieci zamiast ULDK) */
  parcelSource?: ParcelSource;
  /** obrysy dzialek dla obszaru (testy: dzialki w pamieci zamiast WFS GUGiK) */
  parcelOutlineSource?: ParcelOutlineSource;
  /** zrodla danych analizy - podmiana pojedynczych zrodel (testy: zrodlo, ktore milczy albo sie spoznia) */
  analysisSources?: Partial<DataSources>;
  /** geokoder (testy: miejsca w pamieci zamiast Nominatim) */
  placeSource?: PlaceSource;
  /** kafle hydrografii do mapy; null = brak bazy (testy: kafle w pamieci albo brak konfiguracji) */
  hydroMapSource?: HydroMapSource | null;
}

export function createContainer(deps: ContainerDeps, overrides: ContainerOverrides = {}): Container {
  const now = overrides.now ?? nowIso;

  const parcels = createParcelsService({
    // ULDK jest zrodlem podstawowym (pelny opis, cala Polska); gdy zawiedzie albo przytnie limit, dzialke oddaje WFS
    source: overrides.parcelSource ?? withFallback(createUldkParcelSource(), createEgibWfsParcelSource()),
    outlines: overrides.parcelOutlineSource ?? createEgibWfsOutlineSource(),
    now,
  });

  const places = createPlacesService({ source: overrides.placeSource ?? createNominatimPlaceSource() });
  const sqlRunner = deps.vars.DATABASE_URL ? createNeonSqlRunner(deps.vars.DATABASE_URL) : null;

  const hydro = createHydroService({
    source:
      overrides.hydroMapSource !== undefined
        ? overrides.hydroMapSource
        : sqlRunner && createPostgisHydroMapSource({ run: sqlRunner }),
  });

  // Pogoda (NASA POWER), prognoza (MET Norway), gleba (SoilGrids), woda w otoczeniu (BDOT10k) i satelita (Sentinel-2,
  // Copernicus) sa prawdziwe; teren to wciaz atrapa (`sample: true`, raport niesie `meta.sample`), a strefy -
  // reguly przykladowe (`meta.sampleParts`). Pakiety planu docs/plans/silnik-analizy-i-raport.md podmieniaja je
  // tutaj pojedynczo. Testy dostaja zrodla w pamieci przez `analysisSources` (test/helpers.ts).
  const analysis = createAnalysisService({
    parcels,
    sources: {
      ...createSampleSources(),
      meteo: createNasaPowerMeteoSource(),
      forecast: createMetNorwayForecastSource(),
      soil: createSoilGridsSource(),
      // hydrografia BDOT10k w Postgresie (Neon); bez DATABASE_URL zrodlo zglasza brak danych
      hydro: createPostgisHydroSource({
        run: sqlRunner,
      }),
      // Sentinel-2 przez API statystyk Copernicus; bez kluczy OAuth zrodlo zglasza brak danych
      vegetation: createSentinelStatisticsSource({
        clientId: deps.vars.COPERNICUS_CLIENT_ID,
        clientSecret: deps.vars.COPERNICUS_CLIENT_SECRET,
      }),
      ...overrides.analysisSources,
    },
    stages: engineStages,
    now,
  });

  return {
    analysis,
    parcels,
    places,
    hydro,
    edgeCache: overrides.edgeCache ?? createEdgeCachePurger(deps.logger.child({ component: 'edge-cache' })),
  };
}
