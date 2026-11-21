import { describe, expect, it } from 'vitest';

import { createPostgisHydroMapSource, hydroTileQueries } from './hydro-tile';
import type { SqlRunner } from './hydro-postgis';

describe('createPostgisHydroMapSource', () => {
  it('przekazuje zasieg kafla i limit, czyta GeoJSON i date importu', async () => {
    const seen: unknown[][] = [];
    const run: SqlRunner = (queries) => {
      seen.push(...queries.map((query) => query.params));

      return Promise.resolve([
        [
          {
            kind: 2,
            name: 'Srebrna',
            geometry: '{"type":"LineString","coordinates":[[21.5,52.1],[21.51,52.11]]}',
          },
          { kind: 1, name: '', geometry: '{"type":"LineString","coordinates":[[21.5,52.1],[21.5,52.12]]}' },
        ],
        [{ imported_at: '2026-11-21 09:12:00+00' }],
      ]);
    };
    const result = await createPostgisHydroMapSource({ run }).tile([21.5, 52.1, 21.52, 52.12], 2001);

    expect(seen[0]).toEqual([21.5, 52.1, 21.52, 52.12, 2001]);
    expect(result.importedAt).toBe('2026-11-21T09:12:00.000Z');
    expect(result.rows.map((row) => [row.kind, row.name])).toEqual([
      [2, 'Srebrna'],
      [1, null],
    ]);
  });

  it('zapytanie najpierw oddaje cieki i rowy', () => {
    expect(hydroTileQueries([0, 0, 1, 1], 10)[0]?.text).toContain(
      'case when h.kind in (1, 2, 3, 4) then 0 else 1 end as priority',
    );
  });
});
