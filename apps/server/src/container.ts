// Kompozycja zaleznosci na request (i na wiadomosc kolejki, cron, krok Workflow): repozytoria (Drizzle/D1)
// + infrastruktura (adaptery bindingow i zewnetrznych uslug) -> serwisy. Zadnego I/O na poziomie modulu. `overrides` pozwalaja testom
// podmienic infrastrukture na faki bez dotykania serwisow.
import { nowIso } from '@app/db';

import type { EdgeCachePurger } from './domain/edge-cache';
import type { ParcelOutlineSource } from './domain/parcel-outline-source';
import { withFallback, type ParcelSource } from './domain/parcel-source';
import type { PlaceSource } from './domain/place-source';
import { createEdgeCachePurger } from './infrastructure/edge-cache';
import { createEgibWfsOutlineSource, createEgibWfsParcelSource } from './infrastructure/egib-wfs';
import { createNominatimPlaceSource } from './infrastructure/nominatim';
import { createUldkParcelSource } from './infrastructure/uldk';
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
  /** geokoder (testy: miejsca w pamieci zamiast Nominatim) */
  placeSource?: PlaceSource;
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

  return {
    parcels,
    places,
    edgeCache: overrides.edgeCache ?? createEdgeCachePurger(deps.logger.child({ component: 'edge-cache' })),
  };
}
