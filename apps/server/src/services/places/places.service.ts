// Wyszukiwanie miejsc po adresie albo nazwie: mapa dojezdza do wyniku, a rolnik klika swoja dzialke.
import { PLACE_LIMITS, type PlaceSearchResult } from '@app/contracts';

import type { PlaceSource } from './ports';

export interface PlacesServiceDeps {
  source: PlaceSource;
}

export function createPlacesService({ source }: PlacesServiceDeps) {
  return {
    async search(query: string): Promise<PlaceSearchResult> {
      return { items: await source.search(query, PLACE_LIMITS.resultsMax) };
    },
  };
}

export type PlacesService = ReturnType<typeof createPlacesService>;
