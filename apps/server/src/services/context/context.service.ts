// Warstwy otoczenia pola na mapie: kafel XYZ (przyblizenie CONTEXT_TILE_ZOOM, ta sama siatka co hydrografia) ->
// drzewa, siec wodna albo obszary chronione BDOT10k przecinajace kafel. Bez bazy (DATABASE_URL) warstw nie ma -
// 503 not_configured, mapa je ukrywa.
import {
  CONTEXT_TILE_FEATURES_MAX,
  CONTEXT_TILE_ZOOM,
  type ContextLayer,
  type ContextTile,
} from '@app/contracts';
import { AppError } from '@app/http';

import { contextTileFromRows } from '../../domain/context-map-source';
import { tileBounds } from '../../domain/tile-bounds';
import type { ContextMapSource } from './ports';

export interface ContextServiceDeps {
  /** null = brak DATABASE_URL */
  source: ContextMapSource | null;
}

export function createContextService({ source }: ContextServiceDeps) {
  return {
    async tile(layer: ContextLayer, x: number, y: number): Promise<ContextTile> {
      if (!source) throw AppError.notConfigured('DATABASE_URL');

      // o jeden wiersz wiecej niz limit: tak wiemy, ze cos ucielismy
      const rows = await source
        .tile(layer, tileBounds(CONTEXT_TILE_ZOOM, x, y), CONTEXT_TILE_FEATURES_MAX + 1)
        .catch((error: unknown) => {
          throw AppError.upstream('BDOT10k field surroundings database', error);
        });

      return contextTileFromRows(layer, rows);
    },
  };
}

export type ContextService = ReturnType<typeof createContextService>;
