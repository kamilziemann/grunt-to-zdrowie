// Kontrakt kontenera (DI) i zmiennych requestu Hono. Lezy w services, bo to jedyna warstwa, ktora moga importowac
// zarowno modules (handlery biora serwisy z c.get('container')), jak i entry (middleware buduje kontener).
// Implementacja fabryki: src/container.ts (root), wstrzykiwana do createApp() przez src/index.ts.
import type { Identity } from '@app/contracts';
import type { RawServerEnv, ServerVars } from '@app/env/server';
import type { Logger, TraceContext } from '@app/logger';

import type { EdgeCachePurger } from '../../domain/edge-cache';
import type { ParcelsService } from '../parcels';
import type { PlacesService } from '../places';

export interface Container {
  /** dzialki ewidencyjne: wyszukiwanie i geometria (zrodlo: ULDK GUGiK) */
  parcels: ParcelsService;
  /** miejsca po adresie albo nazwie (geokoder) */
  places: PlacesService;
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
  /** zalogowany uzytkownik; null = niezalogowany albo auth wylaczone (AUTH_ENABLED=false) */
  identity: Identity | null;
}

export interface AppEnv {
  Bindings: RawServerEnv;
  Variables: AppVariables;
}
