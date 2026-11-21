import { HYDRO_TILE_FEATURES_MAX, HYDRO_TILE_ZOOM } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { tileBounds } from '../../domain/tile-bounds';
import { createHydroService } from './hydro.service';
import type { HydroMapSource } from './ports';

describe('createHydroService', () => {
  it('pyta zrodlo o zasieg kafla z limitem o jeden wiekszym', async () => {
    const calls: unknown[] = [];
    const source: HydroMapSource = {
      tile: (bounds, limit) => {
        calls.push([bounds, limit]);

        return Promise.resolve({ rows: [], importedAt: null });
      },
    };

    await expect(createHydroService({ source }).tile(9172, 5398)).resolves.toEqual({
      features: [],
      truncated: false,
      importedAt: null,
    });
    expect(calls).toEqual([[tileBounds(HYDRO_TILE_ZOOM, 9172, 5398), HYDRO_TILE_FEATURES_MAX + 1]]);
  });

  it('bez bazy zglasza not_configured, blad bazy = upstream', async () => {
    await expect(createHydroService({ source: null }).tile(0, 0)).rejects.toMatchObject({
      code: 'not_configured',
    });
    await expect(
      createHydroService({ source: { tile: () => Promise.reject(new Error('down')) } }).tile(0, 0),
    ).rejects.toMatchObject({ code: 'upstream_failed' });
  });
});
