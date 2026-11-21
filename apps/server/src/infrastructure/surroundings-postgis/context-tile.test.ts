import { describe, expect, it } from 'vitest';

import type { SqlRunner } from '../hydro-postgis';
import { contextTileQueries, createPostgisContextMapSource } from './context-tile';

describe('createPostgisContextMapSource', () => {
  it('przekazuje zasieg kafla i limit, czyta GeoJSON i date importu wlasciwej tabeli', async () => {
    const seen: unknown[][] = [];
    const run: SqlRunner = (queries) => {
      seen.push(...queries.map((query) => query.params));

      return Promise.resolve([
        [
          {
            kind: 30,
            name: '',
            geometry: '{"type":"LineString","coordinates":[[17.4,51.53],[17.41,51.53]]}',
          },
          { kind: 34, name: 'Źródło Marii', geometry: '{"type":"Point","coordinates":[17.4,51.54]}' },
        ],
        [{ imported_at: '2026-11-21 23:06:49.15+00' }],
      ]);
    };
    const result = await createPostgisContextMapSource({ run }).tile(
      'waterworks',
      [17.4, 51.52, 17.42, 51.54],
      2001,
    );

    expect(seen).toEqual([[17.4, 51.52, 17.42, 51.54, 2001, [30, 31, 32, 33, 34]], ['bdot_waterworks']]);
    expect(result.importedAt).toBe('2026-11-21T23:06:49.150Z');
    expect(result.rows.map((row) => [row.kind, row.name])).toEqual([
      [30, null],
      [34, 'Źródło Marii'],
    ]);
  });

  it('kazda warstwa pyta tylko swoja tabele; obszary chronione - jeden obiekt na nazwe w kaflu', () => {
    const tables = (['cover', 'waterworks', 'protected'] as const).map(
      (layer) => /from (bdot_\w+) c/.exec(contextTileQueries(layer, [0, 0, 1, 1], 10)[0]?.text ?? '')?.[1],
    );

    expect(tables).toEqual(['bdot_cover', 'bdot_waterworks', 'bdot_protected']);
    expect(contextTileQueries('protected', [0, 0, 1, 1], 10)[0]?.text).toContain('group by c.kind, c.name');
  });
});
