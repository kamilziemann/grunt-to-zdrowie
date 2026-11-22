// Ustawienia warstw mapy dzialek w pamieci przegladarki (localStorage): wybor przetrwa przejscie do raportu i powrot,
// odswiezenie strony i kolejne wizyty. Adres strony zostaje krotki (w nim jest tylko lista dzialek). Na serwerze
// i w pierwszym renderze przegladarki sa wartosci domyslne - zapis wchodzi zaraz po hydracji (useSyncExternalStore).
// Wyjatek: zdjecie z satelity. Kazda wizyta zaczyna od "Brak" (decyzja wlasciciela 2026-11-22: kolory na dzialce
// nie pojawiaja sie same, a zdjecie pobieramy dopiero po wyborze), wiec wybor zyje tylko w pamieci karty - przetrwa
// przejscie do raportu i powrot, ale nie odswiezenie strony ani kolejna wizyte.
import { useCallback, useSyncExternalStore } from 'react';

import { MAP_LAYERS_DEFAULTS, parseMapLayers, type MapLayers } from '../schemas/map-layers.schema';

const STORAGE_KEY = 'gtz:map-layers:v1';
const listeners = new Set<() => void>();
let imagery: MapLayers['imagery'] = MAP_LAYERS_DEFAULTS.imagery;
let cached: { raw: string | null; imagery: MapLayers['imagery']; value: MapLayers } = {
  raw: null,
  imagery,
  value: MAP_LAYERS_DEFAULTS,
};

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

  if (raw !== cached.raw || imagery !== cached.imagery) {
    cached = { raw, imagery, value: { ...parseMapLayers(raw), imagery } };
  }

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
  // do pamieci przegladarki idzie zawsze "Brak" - wybor zdjecia zostaje w pamieci karty
  const raw = JSON.stringify({ ...next, imagery: MAP_LAYERS_DEFAULTS.imagery });

  imagery = next.imagery;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // bez pamieci ustawienie dziala do odswiezenia strony
  }

  cached = { raw: read() === raw ? raw : cached.raw, imagery, value: next };

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
