// Leniwe ladowanie MapLibre GL (osobny chunk, tylko w przegladarce) razem z kodem jego workera.
// MapLibre 6 sam szuka pliku workera obok swojego modulu, czego bundler nie widzi, wiec adres podajemy jawnie.
// Worker idzie jako tekst (`?raw`) i startuje z adresu blob: plik serwowany przez Vite w trybie dev dostaje
// doklejony klient HMR, ktory w workerze pada na `document`, a tak dev i build dzialaja identycznie.
import type * as MapLibre from 'maplibre-gl';

let loading: Promise<typeof MapLibre> | null = null;

export function loadMapLibre(): Promise<typeof MapLibre> {
  loading ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?raw'),
  ]).then(([maplibre, worker]) => {
    maplibre.setWorkerUrl(URL.createObjectURL(new Blob([worker.default], { type: 'text/javascript' })));

    return maplibre;
  });

  return loading;
}
