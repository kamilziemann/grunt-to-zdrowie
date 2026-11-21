// /context/tile z kaflami w pamieci (testy nie wolaja bazy): kontrakt, walidacja warstwy, cache brzegowy i brak bazy.
import { contextTileSchema } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { ContextMapSource } from '../../src/domain/context-map-source';
import { makeApp } from '../helpers';

const contextMapSource: ContextMapSource = {
  tile: (layer, [west, south]) =>
    Promise.resolve({
      rows:
        layer === 'waterworks'
          ? [{ kind: 34, name: 'Źródło Marii', geometry: { type: 'Point', coordinates: [west, south] } }]
          : [],
      importedAt: '2026-11-21T23:06:49.150Z',
    }),
};

describe('/context/tile', () => {
  it('oddaje kafel warstwy zgodny z kontraktem, z cache brzegowym i tagiem danych BDOT10k', async () => {
    const res = await makeApp({ contextMapSource }).request('/context/tile?layer=waterworks&x=8983&y=5446');
    const body = contextTileSchema.parse(await res.json());

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      layer: 'waterworks',
      truncated: false,
      importedAt: '2026-11-21T23:06:49.150Z',
    });
    expect(body.features[0]).toMatchObject({
      kind: 'spring',
      name: 'Źródło Marii',
      geometry: { type: 'Point' },
    });
    expect(res.headers.get('cache-tag')).toContain('hydro');
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('nieznana warstwa albo indeks spoza siatki = 400, brak bazy = 503 not_configured', async () => {
    const app = makeApp({ contextMapSource });

    expect((await app.request('/context/tile?layer=roads&x=1&y=1')).status).toBe(400);
    expect((await app.request('/context/tile?layer=cover&x=16384&y=0')).status).toBe(400);

    const res = await makeApp().request('/context/tile?layer=cover&x=1&y=1');

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'not_configured' });
  });
});
