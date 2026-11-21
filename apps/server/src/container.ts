// Kompozycja zaleznosci na request (i na wiadomosc kolejki, cron, krok Workflow): repozytoria (Drizzle/D1)
// + infrastruktura (adaptery bindingow i zewnetrznych uslug) -> serwisy. Zadnego I/O na poziomie modulu. `overrides` pozwalaja testom
// podmienic infrastrukture na faki bez dotykania serwisow.
import type { EdgeCachePurger } from './domain/edge-cache';
import { createEdgeCachePurger } from './infrastructure/edge-cache';
import type { Container, ContainerDeps } from './services/container';

export interface ContainerOverrides {
  /** czyszczenie cache'u brzegowego (testy: purger zapamietujacy wywolania) */
  edgeCache?: EdgeCachePurger;
}

export function createContainer(deps: ContainerDeps, overrides: ContainerOverrides = {}): Container {
  return {
    edgeCache: overrides.edgeCache ?? createEdgeCachePurger(deps.logger.child({ component: 'edge-cache' })),
  };
}
