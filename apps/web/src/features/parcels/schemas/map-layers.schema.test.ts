import { describe, expect, it } from 'vitest';

import { MAP_LAYERS_DEFAULTS, parseMapLayers } from './map-layers.schema';

describe('map-layers.schema', () => {
  it('brak zapisu albo smieci = domyslne (granice i rowy wlaczone, reszta wylaczona)', () => {
    expect(parseMapLayers(null)).toEqual(MAP_LAYERS_DEFAULTS);
    expect(parseMapLayers('{nie json')).toEqual(MAP_LAYERS_DEFAULTS);
    expect(parseMapLayers('7')).toEqual(MAP_LAYERS_DEFAULTS);
    expect(MAP_LAYERS_DEFAULTS).toMatchObject({
      boundaries: true,
      hydro: true,
      cover: false,
      imagery: 'none',
    });
  });

  it('zly albo brakujacy wpis zastepuje tylko on sam', () => {
    expect(
      parseMapLayers(
        JSON.stringify({ basemap: 'ortho', cover: true, imagery: 'radar', imageryMonth: '2018-06' }),
      ),
    ).toEqual({ ...MAP_LAYERS_DEFAULTS, basemap: 'ortho', cover: true, imageryMonth: '2018-06' });
  });
});
