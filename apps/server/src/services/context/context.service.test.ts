import { CONTEXT_TILE_FEATURES_MAX, CONTEXT_TILE_ZOOM } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { tileBounds } from '../../domain/tile-bounds';
import { createContextService } from './context.service';
import type { ContextMapSource } from './ports';

describe('createContextService', () => {
  it('pyta zrodlo o warstwe i zasieg kafla z limitem o jeden wiekszym', async () => {
    const calls: unknown[] = [];
    const source: ContextMapSource = {
      tile: (layer, bounds, limit) => {
        calls.push([layer, bounds, limit]);

        return Promise.resolve({ rows: [], importedAt: '2026-11-21T22:52:46.580Z' });
      },
    };

    await expect(createContextService({ source }).tile('protected', 8983, 5446)).resolves.toEqual({
      layer: 'protected',
      features: [],
      truncated: false,
      importedAt: '2026-11-21T22:52:46.580Z',
    });
    expect(calls).toEqual([
      ['protected', tileBounds(CONTEXT_TILE_ZOOM, 8983, 5446), CONTEXT_TILE_FEATURES_MAX + 1],
    ]);
  });

  it('bez bazy zglasza not_configured, blad bazy = upstream', async () => {
    await expect(createContextService({ source: null }).tile('cover', 0, 0)).rejects.toMatchObject({
      code: 'not_configured',
    });
    await expect(
      createContextService({ source: { tile: () => Promise.reject(new Error('down')) } }).tile('cover', 0, 0),
    ).rejects.toMatchObject({ code: 'upstream_failed' });
  });
});
