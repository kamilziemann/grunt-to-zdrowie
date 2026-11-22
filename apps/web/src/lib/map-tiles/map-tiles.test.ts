import { describe, expect, it, vi } from 'vitest';

import { createTileLayer, type TileLayerState, type TileView } from './map-tiles';

const VIEW: TileView = { west: 0, south: 0, east: 2, north: 1, zoom: 14 };

function setup(load: (x: number, y: number) => Promise<string>) {
  const states: TileLayerState[] = [];
  const data: string[][] = [];
  const layer = createTileLayer({
    // jeden kafel na kazdy stopien dlugosci widoku
    tilesFor: (west, _south, east) =>
      Array.from({ length: east - west }, (_, index) => ({ x: west + index, y: 0 })),
    load,
    minZoom: 13,
    maxTiles: 3,
    cacheSize: 2,
    isUnavailable: (error) => error instanceof RangeError,
    onData: (tiles) => data.push(tiles),
    onState: (state) => states.push(state),
  });

  return { layer, states, data };
}

describe('map-tiles', () => {
  it('pobiera brakujace kafle raz, potem stan gotowy bez nowych zapytan', async () => {
    const load = vi.fn<(x: number) => Promise<string>>((x) => Promise.resolve(`kafel ${String(x)}`));
    const { layer, states, data } = setup(load);

    layer.refresh(VIEW);
    layer.refresh(VIEW);
    await vi.waitFor(() => expect(states.at(-1)).toBe('ready'));
    layer.refresh(VIEW);

    expect(load).toHaveBeenCalledTimes(2);
    expect(data.at(-1)).toEqual(['kafel 0', 'kafel 1']);
    expect(states).toEqual(['loading', 'loading', 'ready', 'ready']);
  });

  it('wylaczona, za male przyblizenie albo za duzo kafli - bez zapytan', () => {
    const load = vi.fn<() => Promise<string>>(() => Promise.resolve('x'));
    const { layer, states } = setup(load);

    layer.refresh(null);
    layer.refresh({ ...VIEW, zoom: 12 });
    layer.refresh({ ...VIEW, east: 10 });

    expect(load).not.toHaveBeenCalled();
    expect(states).toEqual(['off', 'zoom', 'zoom']);
  });

  it('blad "niedostepna" daje stan unavailable, inny blad tylko pomija kafel', async () => {
    const { layer, states } = setup((x) =>
      x === 0 ? Promise.reject(new RangeError('503')) : Promise.reject(new Error('siec')),
    );

    layer.refresh(VIEW);
    await vi.waitFor(() => expect(states.at(-1)).toBe('unavailable'));

    const other = setup(() => Promise.reject(new Error('siec')));

    other.layer.refresh(VIEW);
    await vi.waitFor(() => expect(other.states.at(-1)).toBe('ready'));
  });

  it('pamiec ograniczona: kafle spoza widoku wypadaja; po clear odpowiedzi starych zapytan sa pomijane', async () => {
    const { layer, states, data } = setup((x) => Promise.resolve(String(x)));

    layer.refresh(VIEW);
    await vi.waitFor(() => expect(states.at(-1)).toBe('ready'));
    layer.refresh({ ...VIEW, west: 5, east: 6 });
    await vi.waitFor(() => expect(data.at(-1)).toEqual(['1', '5']));

    let resolve: (value: string) => void = () => undefined;
    const late = setup(() => new Promise<string>((done) => (resolve = done)));

    late.layer.refresh({ ...VIEW, east: 1 });
    late.layer.clear();
    resolve('stary');
    await Promise.resolve();

    expect(late.layer.tiles()).toEqual([]);
    expect(late.data).toEqual([]);
  });
});
