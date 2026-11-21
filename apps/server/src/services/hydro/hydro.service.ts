// Warstwa "woda w otoczeniu" na mapie: kafel XYZ (przyblizenie HYDRO_TILE_ZOOM) -> rowy, cieki, wody i mokradla
// BDOT10k przecinajace kafel. Bez bazy (DATABASE_URL) warstwy nie ma - 503 not_configured, mapa ja ukrywa.
import { HYDRO_TILE_FEATURES_MAX, HYDRO_TILE_ZOOM, type HydroTile } from '@app/contracts';
import { AppError } from '@app/http';

import { hydroTileFromRows } from '../../domain/hydro-map-source';
import { tileBounds } from '../../domain/tile-bounds';
import type { HydroMapSource } from './ports';

export interface HydroServiceDeps {
  /** null = brak DATABASE_URL */
  source: HydroMapSource | null;
}

export function createHydroService({ source }: HydroServiceDeps) {
  return {
    async tile(x: number, y: number): Promise<HydroTile> {
      if (!source) throw AppError.notConfigured('DATABASE_URL');

      // o jeden wiersz wiecej niz limit: tak wiemy, ze cos ucielismy
      const rows = await source
        .tile(tileBounds(HYDRO_TILE_ZOOM, x, y), HYDRO_TILE_FEATURES_MAX + 1)
        .catch((error: unknown) => {
          throw AppError.upstream('BDOT10k hydrography database', error);
        });

      return hydroTileFromRows(rows);
    },
  };
}

export type HydroService = ReturnType<typeof createHydroService>;
