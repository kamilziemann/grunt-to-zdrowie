// /hydro/tile z kaflami w pamieci (testy nie wolaja bazy): kontrakt, walidacja, cache brzegowy i brak konfiguracji.
import { hydroTileSchema } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { HydroMapSource } from '../../src/domain/hydro-map-source';
import { makeApp } from '../helpers';

const hydroMapSource: HydroMapSource = {
  tile: ([west, south]) =>
    Promise.resolve({
      rows: [
        {
          kind: 1,
          name: null,
          geometry: {
            type: 'LineString',
            coordinates: [
              [west, south],
              [west + 0.001, south + 0.001],
            ],
          },
        },
      ],
      importedAt: '2026-11-21T09:12:00.000Z',
    }),
};

describe('/hydro/tile', () => {
  it('oddaje kafel zgodny z kontraktem, z cache brzegowym i tagiem hydro', async () => {
    const res = await makeApp({ hydroMapSource }).request('/hydro/tile?x=9172&y=5398');
    const body = hydroTileSchema.parse(await res.json());

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ truncated: false, importedAt: '2026-11-21T09:12:00.000Z' });
    expect(body.features[0]).toMatchObject({ kind: 'ditch', name: null, geometry: { type: 'LineString' } });
    expect(res.headers.get('cache-tag')).toContain('hydro');
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('indeks spoza siatki = 400, brak bazy = 503 not_configured', async () => {
    expect((await makeApp({ hydroMapSource }).request('/hydro/tile?x=16384&y=0')).status).toBe(400);

    const res = await makeApp().request('/hydro/tile?x=1&y=1');

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'not_configured' });
  });
});
