// Kompozycja zaleznosci na request (i na wiadomosc kolejki, cron, krok Workflow): repozytoria (Drizzle/D1)
// + infrastruktura (adaptery bindingow i zewnetrznych uslug) -> serwisy. Zadnego I/O na poziomie modulu. `overrides` pozwalaja testom
// podmienic infrastrukture na faki bez dotykania serwisow.
import { createDb, nowIso } from '@app/db';

import type { DataSources } from './domain/analysis-ports';
import type { EdgeCachePurger } from './domain/edge-cache';
import type { HydroMapSource } from './domain/hydro-map-source';
import { engineStages } from './domain/engine-stages';
import type { ParcelOutlineSource } from './domain/parcel-outline-source';
import { withFallback, type ParcelRegistry, type ParcelSource } from './domain/parcel-source';
import type { PlaceSource } from './domain/place-source';
import type { ReportStore } from './domain/report-store';
import { createEdgeCachePurger } from './infrastructure/edge-cache';
import {
  createEgibWfsOutlineSource,
  createEgibWfsParcelSource,
  createEgibWfsRegistry,
} from './infrastructure/egib-wfs';
import {
  createNeonSqlRunner,
  createPostgisHydroMapSource,
  createPostgisHydroSource,
} from './infrastructure/hydro-postgis';
import { createMetNorwayForecastSource } from './infrastructure/meteo-met-norway';
import { createNasaPowerMeteoSource, nasaPowerCacheTtl } from './infrastructure/meteo-nasa-power';
import { createNominatimPlaceSource } from './infrastructure/nominatim';
import { cachedFetch, workersResponseStore, type ResponseStore } from './infrastructure/response-cache';
import { createSentinelStatisticsSource, sentinelCacheTtl } from './infrastructure/sentinel-statistics';
import { createSoilGridsSource, soilGridsCacheTtl } from './infrastructure/soilgrids';
import { STATIC_TTL_S } from './domain/source-cache-policy';
import { createTerrainTilesSource } from './infrastructure/terrain-tiles';
import { createUldkParcelSource } from './infrastructure/uldk';
import { createReportsRepository } from './repositories/reports';
import { isoDateInPoland } from './domain/iso-date';
import { createCopernicusImagerySource } from './infrastructure/copernicus-imagery';
import { createAnalysisService } from './services/analysis';
import { createHydroService } from './services/hydro';
import type { Container, ContainerDeps } from './services/container';
import { createImageryService } from './services/imagery';
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
  /** pamiec odpowiedzi zrodel analizy; null = bez pamieci (domyslnie Cache API Workera, gdy jest) */
  responseStore?: ResponseStore | null;
  /** ewidencja (klasouzytki) dla analizy; null = bez ewidencji (testy: bez WFS GUGiK) */
  parcelRegistry?: ParcelRegistry | null;
  /** zapis raportow; null = bez zapisu (domyslnie D1) */
  reportStore?: ReportStore | null;
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

  // Wszystkie zrodla sa prawdziwe: pogoda (NASA POWER), prognoza (MET Norway), gleba (SoilGrids), teren (kafle
  // wysokosci terrarium), woda w otoczeniu (BDOT10k) i satelita (Sentinel-2, Copernicus); przykladowe zostaly tylko
  // strefy (`meta.sampleParts`). Testy dostaja zrodla w pamieci przez `analysisSources` (test/helpers.ts).
  //
  // Pamiec odpowiedzi: kolejne analizy tego samego pola i sasiednich dzialek nie pytaja dostawcow drugi raz
  // (limity Copernicus i NASA POWER przy trybie "gospodarstwo"); historia - 30 dni, ostatnie dni - 3 h
  const store = overrides.responseStore !== undefined ? overrides.responseStore : workersResponseStore();
  const today = () => isoDateInPoland(now());
  const remember = (ttl: (url: string, init: RequestInit | undefined) => number) =>
    cachedFetch((url, init) => fetch(url, init), store, ttl);

  const analysis = createAnalysisService({
    parcels,
    sources: {
      meteo: createNasaPowerMeteoSource({ fetch: remember(nasaPowerCacheTtl(today)) }),
      forecast: createMetNorwayForecastSource(),
      soil: createSoilGridsSource({ fetch: remember(soilGridsCacheTtl) }),
      // model wysokosci (kafle terrarium: EU-DEM / SRTM) - teren sie nie zmienia
      terrain: createTerrainTilesSource({ fetch: remember(() => STATIC_TTL_S) }),
      // hydrografia BDOT10k w Postgresie (Neon); bez DATABASE_URL zrodlo zglasza brak danych
      hydro: createPostgisHydroSource({ run: sqlRunner }),
      // Sentinel-2 przez API statystyk Copernicus; bez kluczy OAuth zrodlo zglasza brak danych
      vegetation: createSentinelStatisticsSource({
        fetch: remember(sentinelCacheTtl(today)),
        clientId: deps.vars.COPERNICUS_CLIENT_ID,
        clientSecret: deps.vars.COPERNICUS_CLIENT_SECRET,
      }),
      ...overrides.analysisSources,
    },
    stages: engineStages,
    // zapis raportow w D1: powtorka tego samego zadania wraca z zapisu, raport otwiera sie z linku
    ...(overrides.reportStore === null
      ? {}
      : { reports: overrides.reportStore ?? createReportsRepository(createDb(deps.env.DB)) }),
    // klasouzytki i powierzchnia ewidencyjna z WFS ewidencji (ULDK ich nie podaje)
    ...(overrides.parcelRegistry === null
      ? {}
      : { registry: overrides.parcelRegistry ?? createEgibWfsRegistry() }),
    now,
  });

  return {
    analysis,
    parcels,
    places,
    hydro,
    imagery: createImageryService({
      parcels,
      source: createCopernicusImagerySource(copernicusKeys(deps)),
      now,
    }),
    edgeCache: overrides.edgeCache ?? createEdgeCachePurger(deps.logger.child({ component: 'edge-cache' })),
  };
}

const copernicusKeys = ({ vars }: ContainerDeps) => ({
  clientId: vars.COPERNICUS_CLIENT_ID,
  clientSecret: vars.COPERNICUS_CLIENT_SECRET,
});
