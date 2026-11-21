// Warstwy MapLibre dla "Rowow i ciekow": rowy cienka linia, strumienie i rzeki grubsza z nazwa wzdluz linii,
// kanaly linia przerywana, wody wypelnieniem, mokradla wzorem ukosnych kresek. Kolory z tokenow `--map-*` (podklad
// jest jasny w obu motywach); jasna podkladka pod liniami trzyma je czytelne na zdjeciu lotniczym.
import type { FeatureCollection } from 'geojson';
import type * as MapLibre from 'maplibre-gl';

export const HYDRO_LINES_SOURCE = 'hydro-lines';
export const HYDRO_AREAS_SOURCE = 'hydro-areas';
export const HYDRO_ATTRIBUTION = 'Rowy i cieki © GUGiK (BDOT10k)';
const WETLAND_PATTERN = 'hydro-wetland-pattern';

export const HYDRO_LAYER_IDS = [
  'hydro-water-fill',
  'hydro-wetland-fill',
  'hydro-water-outline',
  'hydro-wetland-outline',
  'hydro-lines-casing',
  'hydro-lines',
  'hydro-canals',
  'hydro-labels',
];

export interface HydroColors {
  ditch: string;
  stream: string;
  water: string;
  wetland: string;
  label: string;
  casing: string;
}

/** Kolory warstwy z tokenow CSS kontenera mapy. */
export function hydroColors(element: HTMLElement): HydroColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();

  return {
    ditch: token('--map-ditch'),
    stream: token('--map-stream'),
    water: token('--map-water'),
    wetland: token('--map-wetland'),
    label: token('--map-water-label'),
    casing: token('--map-casing'),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);

  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Wzor mokradla: ukosne kreski na przezroczystym tle (kafelek 12 px powtarzany przez `fill-pattern`). */
function wetlandPattern(color: string): { width: number; height: number; data: Uint8Array } {
  const size = 12;
  const data = new Uint8Array(size * size * 4);
  const [r, g, b] = hexToRgb(color);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // dwie kreski grubosci 2 px na kafelek, ciagle po powtorzeniu
      const on = (x + y) % 6 < 2;
      const offset = (y * size + x) * 4;

      data.set(on ? [r, g, b, 210] : [r, g, b, 28], offset);
    }
  }

  return { width: size, height: size, data };
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Linie grubsze dla cieku niz dla rowu, szersze przy duzym przyblizeniu; `extra` = podkladka pod linia. */
function lineWidth(extra = 0): MapLibre.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    12,
    [
      'match',
      ['get', 'kind'],
      'river',
      2.5 + extra,
      'stream',
      1.8 + extra,
      'canal',
      1.8 + extra,
      0.8 + extra,
    ],
    17,
    ['match', ['get', 'kind'], 'river', 5 + extra, 'stream', 3.5 + extra, 'canal', 3.5 + extra, 2 + extra],
  ];
}

/**
 * Zrodla i warstwy hydrografii na gotowym stylu. `before` = id warstwy, pod ktora wstawic (np. granice dzialek,
 * zeby obrys pola zostal na wierzchu); `minzoom` = od jakiego przyblizenia rysowac.
 */
export function addHydroLayers(
  map: MapLibre.Map,
  colors: HydroColors,
  { before, minzoom = 0 }: { before?: string; minzoom?: number } = {},
): void {
  if (!map.hasImage(WETLAND_PATTERN)) map.addImage(WETLAND_PATTERN, wetlandPattern(colors.wetland));

  map.addSource(HYDRO_AREAS_SOURCE, { type: 'geojson', data: EMPTY, attribution: HYDRO_ATTRIBUTION });
  map.addSource(HYDRO_LINES_SOURCE, { type: 'geojson', data: EMPTY });

  const isWetland: MapLibre.ExpressionSpecification = [
    'match',
    ['get', 'kind'],
    ['wetland', 'bog'],
    true,
    false,
  ];

  map.addLayer(
    {
      id: 'hydro-water-fill',
      type: 'fill',
      source: HYDRO_AREAS_SOURCE,
      minzoom,
      filter: ['!', isWetland],
      paint: { 'fill-color': colors.water, 'fill-opacity': 0.55 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-wetland-fill',
      type: 'fill',
      source: HYDRO_AREAS_SOURCE,
      minzoom,
      filter: isWetland,
      paint: { 'fill-pattern': WETLAND_PATTERN },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-water-outline',
      type: 'line',
      source: HYDRO_AREAS_SOURCE,
      minzoom,
      filter: ['!', isWetland],
      paint: { 'line-color': colors.stream, 'line-width': 1.2 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-wetland-outline',
      type: 'line',
      source: HYDRO_AREAS_SOURCE,
      minzoom,
      filter: isWetland,
      paint: { 'line-color': colors.wetland, 'line-width': 1.2, 'line-dasharray': [2, 1.5] },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-lines-casing',
      type: 'line',
      source: HYDRO_LINES_SOURCE,
      minzoom,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': colors.casing, 'line-width': lineWidth(2), 'line-opacity': 0.75 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-lines',
      type: 'line',
      source: HYDRO_LINES_SOURCE,
      minzoom,
      filter: ['!=', ['get', 'kind'], 'canal'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['match', ['get', 'kind'], 'ditch', colors.ditch, colors.stream],
        'line-width': lineWidth(),
      },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-canals',
      type: 'line',
      source: HYDRO_LINES_SOURCE,
      minzoom,
      filter: ['==', ['get', 'kind'], 'canal'],
      paint: { 'line-color': colors.stream, 'line-width': lineWidth(), 'line-dasharray': [3, 1.5] },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hydro-labels',
      type: 'symbol',
      source: HYDRO_LINES_SOURCE,
      minzoom: Math.max(minzoom, 13),
      filter: ['all', ['!=', ['get', 'name'], ''], ['!=', ['get', 'kind'], 'ditch']],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 18, 14],
        'text-letter-spacing': 0.05,
        'symbol-spacing': 320,
      },
      paint: { 'text-color': colors.label, 'text-halo-color': colors.casing, 'text-halo-width': 2 },
    },
    before,
  );
}

/** Nowe dane warstwy (linie i poligony). */
export function setHydroData(
  map: MapLibre.Map,
  collections: { lines: FeatureCollection; areas: FeatureCollection },
): void {
  void map.getSource<MapLibre.GeoJSONSource>(HYDRO_LINES_SOURCE)?.setData(collections.lines);
  void map.getSource<MapLibre.GeoJSONSource>(HYDRO_AREAS_SOURCE)?.setData(collections.areas);
}

/** Widocznosc wszystkich warstw hydrografii. */
export function setHydroVisible(map: MapLibre.Map, visible: boolean): void {
  for (const id of HYDRO_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
