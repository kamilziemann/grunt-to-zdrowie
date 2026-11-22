// Warstwa mapy czytana kaflami siatki XYZ (rowy i cieki, otoczenie pola): ktore kafle widoku brakuje, pobieranie
// ich bez powtorzen, pamiec ograniczona do `cacheSize` kafli i stan dla legendy. Bez MapLibre i Reacta - mapa podaje
// widok po kazdym ruchu, a dane i stan odbiera w wywolaniach zwrotnych.

export interface TileIndex {
  x: number;
  y: number;
}

/** Widok mapy: prostokat [zachod, poludnie, wschod, polnoc] i przyblizenie. */
export interface TileView {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

/**
 * `off` = warstwa wylaczona, `zoom` = za male przyblizenie (nic nie pobieramy), `unavailable` = API odpowiada
 * 404/502/503 (baza nie odpowiada albo trasy jeszcze nie ma).
 */
export type TileLayerState = 'off' | 'zoom' | 'loading' | 'ready' | 'unavailable';

export interface TileLayerOptions<T> {
  /** kafle pokrywajace prostokat widoku */
  tilesFor: (west: number, south: number, east: number, north: number) => TileIndex[];
  load: (x: number, y: number) => Promise<T>;
  /** od tego przyblizenia warstwa sie pobiera */
  minZoom: number;
  /** wiecej kafli w widoku = za male przyblizenie albo ogromny ekran; nie zasypujemy API zapytaniami */
  maxTiles: number;
  /** ile kafli trzymamy w pamieci (starsze spoza widoku wypadaja) */
  cacheSize: number;
  /** blad oznaczajacy "warstwa chwilowo niedostepna" (inne bledy pomijaja kafel bez komunikatu) */
  isUnavailable: (error: unknown) => boolean;
  /** nowe dane: wszystkie kafle w pamieci */
  onData: (tiles: T[]) => void;
  /** zmiana stanu warstwy z kaflami w pamieci (wolane takze przy tym samym stanie - odbiorca sam porownuje) */
  onState: (state: TileLayerState, tiles: T[]) => void;
}

export interface TileLayer<T> {
  /** widok po ruchu mapy; null = warstwa wylaczona */
  refresh: (view: TileView | null) => void;
  tiles: () => T[];
  clear: () => void;
}

const key = (tile: TileIndex) => `${String(tile.x)}/${String(tile.y)}`;

export function createTileLayer<T>(options: TileLayerOptions<T>): TileLayer<T> {
  const cache = new Map<string, T>();
  const pending = new Set<string>();
  let unavailable = false;
  // po `clear` odpowiedzi starszych zapytan nie trafiaja do pamieci (mapa juz nie istnieje)
  let generation = 0;

  const settled = (): TileLayerState => (unavailable ? 'unavailable' : 'ready');
  const report = (state: TileLayerState) => options.onState(state, [...cache.values()]);

  function store(id: string, data: T, visible: ReadonlySet<string>): void {
    cache.set(id, data);

    for (const old of cache.keys()) {
      if (cache.size <= options.cacheSize) break;

      if (!visible.has(old)) cache.delete(old);
    }

    options.onData([...cache.values()]);
  }

  function refresh(view: TileView | null): void {
    if (!view) {
      report('off');

      return;
    }

    const inView = options.tilesFor(view.west, view.south, view.east, view.north);

    if (view.zoom < options.minZoom || inView.length > options.maxTiles) {
      report('zoom');

      return;
    }

    const visible = new Set(inView.map(key));
    const missing = inView.filter((tile) => !cache.has(key(tile)) && !pending.has(key(tile)));

    if (missing.length === 0) {
      report(pending.size > 0 ? 'loading' : settled());

      return;
    }

    unavailable = false;
    report('loading');

    const current = generation;

    for (const tile of missing) {
      const id = key(tile);

      pending.add(id);
      options
        .load(tile.x, tile.y)
        .then((data) => {
          if (current === generation) store(id, data, visible);

          return data;
        })
        // brak warstwy nie blokuje pracy z mapa; kafel sprobuje sie pobrac przy nastepnym ruchu
        .catch((error: unknown) => {
          if (current === generation && options.isUnavailable(error)) unavailable = true;
        })
        .finally(() => {
          if (current !== generation) return;

          pending.delete(id);

          if (pending.size === 0) report(settled());
        });
    }
  }

  return {
    refresh,
    tiles: () => [...cache.values()],
    clear: () => {
      generation += 1;
      cache.clear();
      pending.clear();
      unavailable = false;
    },
  };
}
