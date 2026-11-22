// Ustawienia warstw mapy dzialek w pamieci przegladarki (localStorage): wybor przetrwa przejscie do raportu i powrot,
// odswiezenie strony i kolejne wizyty. Adres strony zostaje krotki (w nim jest tylko lista dzialek). Na serwerze
// i w pierwszym renderze przegladarki sa wartosci domyslne - zapis wchodzi zaraz po hydracji (useSyncExternalStore).
import { useCallback, useSyncExternalStore } from 'react';

import { MAP_LAYERS_DEFAULTS, parseMapLayers, type MapLayers } from '../schemas/map-layers.schema';

const STORAGE_KEY = 'gtz:map-layers:v1';
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: MapLayers } = { raw: null, value: MAP_LAYERS_DEFAULTS };

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // pamiec zablokowana (tryb prywatny, polityka przegladarki) - zostaja wartosci domyslne
    return null;
  }
}

function snapshot(): MapLayers {
  const raw = read();

  if (raw !== cached.raw) cached = { raw, value: parseMapLayers(raw) };

  return cached.value;
}

const serverSnapshot = (): MapLayers => MAP_LAYERS_DEFAULTS;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // zmiana w innej karcie
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function write(next: MapLayers): void {
  const raw = JSON.stringify(next);

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // bez pamieci ustawienie dziala do odswiezenia strony
  }

  cached = { raw: read() === raw ? raw : cached.raw, value: next };

  for (const listener of listeners) listener();
}

export interface MapLayersControl {
  layers: MapLayers;
  /** zmienia czesc ustawien (reszta bez zmian) */
  update: (patch: Partial<MapLayers>) => void;
}

export function useMapLayers(): MapLayersControl {
  const layers = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const update = useCallback(
    (patch: Partial<MapLayers>) =>
      write({
        ...snapshot(),
        ...patch,
        basemapChosen: snapshot().basemapChosen || patch.basemap !== undefined,
      }),
    [],
  );

  return { layers, update };
}
