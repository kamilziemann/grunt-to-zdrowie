// Kontrakt kontenera (DI) i zmiennych requestu Hono. Lezy w services, bo to jedyna warstwa, ktora moga importowac
// zarowno modules (handlery biora serwisy z c.get('container')), jak i entry (middleware buduje kontener).
// Implementacja fabryki: src/container.ts (root), wstrzykiwana do createApp() przez src/index.ts.
import type { RawServerEnv, ServerVars } from '@app/env/server';
import type { Logger, TraceContext } from '@app/logger';

import type { EdgeCachePurger } from '../../domain/edge-cache';
import type { AnalysisService } from '../analysis';
import type { ContextService } from '../context';
import type { HydroService } from '../hydro';
import type { ImageryService } from '../imagery';
import type { ParcelsService } from '../parcels';
import type { PlacesService } from '../places';

export interface Container {
  /** dzialki ewidencyjne: wyszukiwanie i geometria (zrodlo: ULDK GUGiK) */
  parcels: ParcelsService;
  /** analiza wodna pola: dane ze zrodel -> ocena, historia, przyczyny, zalecenia */
  analysis: AnalysisService;
  /** miejsca po adresie albo nazwie (geokoder) */
  places: PlacesService;
  /** hydrografia BDOT10k do mapy (kafle rowow, ciekow, wod i mokradel) */
  hydro: HydroService;
  /** obrazy pola z satelity (pokaz trybu 3D): kondycja roslin NDVI */
  imagery: ImageryService;
  /** otoczenie pola BDOT10k do mapy (kafle drzew, sieci wodnej i obszarow chronionych) */
  context: ContextService;
  /** czyszczenie cache'u brzegowego (Workers Cache) po zmianach widocznych publicznie */
  edgeCache: EdgeCachePurger;
}

export interface ContainerDeps {
  env: RawServerEnv;
  vars: ServerVars;
  logger: Logger;
  waitUntil: (promise: Promise<unknown>) => void;
}

export type ContainerFactory = (deps: ContainerDeps) => Container;

/** Zmienne requestu ustawiane przez middleware (entry/middlewares). */
export interface AppVariables {
  requestId: string;
  /** slad W3C tego requestu (odcinek-dziecko `traceparent` wolajacego) */
  trace: TraceContext;
  logger: Logger;
  vars: ServerVars;
  container: Container;
}

export interface AppEnv {
  Bindings: RawServerEnv;
  Variables: AppVariables;
}
