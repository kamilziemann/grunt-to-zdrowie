// Warstwy MapLibre "otoczenia pola". Kazda rozroznialna bez koloru: lasy spokojnym wypelnieniem, rzedy drzew
// kropkami, zywoploty kreskami; waly gruba linia z podkladka, odcinki w rurach przerywana, budowle (jaz, zapora,
// sluza) kwadratowym znakiem z podpisem, zrodla pustym kolkiem, ujecia pelnym; obszary chronione polprzezroczystym
// wypelnieniem z obrysem (Natura 2000 przerywanym) i jednym podpisem na obszar. Kolory z tokenow `--map-*`.
import type { ContextLayer } from '@app/contracts';
import type { FeatureCollection } from 'geojson';
import type * as MapLibre from 'maplibre-gl';

import { HYDRO_ATTRIBUTION } from '../hydro-map';

import type { ContextCollections } from './context-map';

// ten sam wpis co rowy i cieki: na telefonie atrybucja ma sie miescic w jednym-dwoch wierszach
export const CONTEXT_ATTRIBUTION = HYDRO_ATTRIBUTION;
const STRUCTURE_ICON = 'context-structure';

export interface ContextColors {
  forest: string;
  treeRow: string;
  levee: string;
  piped: string;
  structure: string;
  spring: string;
  protected: string;
  protectedLabel: string;
  casing: string;
}

/** Kolory warstw z tokenow CSS kontenera mapy. */
export function contextColors(element: HTMLElement): ContextColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();

  return {
    forest: token('--map-forest'),
    treeRow: token('--map-tree-row'),
    levee: token('--map-levee'),
    piped: token('--map-piped'),
    structure: token('--map-structure'),
    spring: token('--map-spring'),
    protected: token('--map-protected'),
    protectedLabel: token('--map-protected-label'),
    casing: token('--map-casing'),
  };
}

const sourceIds = (layer: ContextLayer) => ({
  features: `context-${layer}`,
  outlines: `context-${layer}-outlines`,
  marks: `context-${layer}-marks`,
});

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);

  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Znak budowli: ciemny kwadrat z jasna ramka i jasna belka w poprzek (zastawka widziana z gory). */
function structureIcon(color: string, casing: string): { width: number; height: number; data: Uint8Array } {
  const size = 20;
  const data = new Uint8Array(size * size * 4);
  const dark = hexToRgb(color);
  const light = hexToRgb(casing);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const border = x < 3 || y < 3 || x >= size - 3 || y >= size - 3;
      const bar = y >= 9 && y < 11 && x >= 5 && x < size - 5;

      data.set([...(border || bar ? light : dark), 255], (y * size + x) * 4);
    }
  }

  return { width: size, height: size, data };
}

const isPolygon: MapLibre.ExpressionSpecification = ['==', ['geometry-type'], 'Polygon'];
const isLine: MapLibre.ExpressionSpecification = ['==', ['geometry-type'], 'LineString'];
const isPoint: MapLibre.ExpressionSpecification = ['==', ['geometry-type'], 'Point'];
const kindIn = (...kinds: string[]): MapLibre.ExpressionSpecification => [
  'match',
  ['get', 'kind'],
  kinds,
  true,
  false,
];

type LayerSpec = MapLibre.LayerSpecification;

function coverLayers(colors: ContextColors, minzoom: number): LayerSpec[] {
  const { features, outlines } = sourceIds('cover');

  return [
    {
      id: 'context-cover-fill',
      type: 'fill',
      source: features,
      minzoom,
      filter: isPolygon,
      // bez wygladzania krawedzi: kawalki lasu z sasiednich kafli nie maja jasnej szczeliny na styku
      paint: { 'fill-color': colors.forest, 'fill-opacity': 0.3, 'fill-antialias': false },
    },
    {
      id: 'context-cover-outline',
      type: 'line',
      source: outlines,
      minzoom,
      paint: { 'line-color': colors.forest, 'line-width': 1, 'line-opacity': 0.7 },
    },
    {
      id: 'context-cover-rows',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', isLine, kindIn('tree_row')],
      // kropki = korony drzew w rzedzie
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.treeRow,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 6],
        'line-dasharray': [0, 1.6],
      },
    },
    {
      id: 'context-cover-hedges',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', isLine, kindIn('hedge')],
      paint: {
        'line-color': colors.treeRow,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 4],
        'line-dasharray': [2, 1],
      },
    },
  ];
}

function waterworksLayers(colors: ContextColors, minzoom: number): LayerSpec[] {
  const { features, marks } = sourceIds('waterworks');
  const piped = kindIn('piped_ditch', 'piped_watercourse', 'piped_canal');
  const structure = kindIn('weir', 'dam', 'lock');
  const width = (from: number, to: number): MapLibre.ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['zoom'],
    13,
    from,
    17,
    to,
  ];

  return [
    {
      id: 'context-levee-casing',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', isLine, kindIn('levee')],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.casing, 'line-width': width(5, 10), 'line-opacity': 0.85 },
    },
    {
      id: 'context-levee',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', isLine, kindIn('levee')],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.levee, 'line-width': width(3, 6) },
    },
    {
      id: 'context-piped-casing',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', isLine, piped],
      paint: { 'line-color': colors.casing, 'line-width': width(3.5, 6), 'line-opacity': 0.8 },
    },
    {
      id: 'context-piped',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', isLine, piped],
      paint: { 'line-color': colors.piped, 'line-width': width(1.5, 3), 'line-dasharray': [1.2, 1.2] },
    },
    {
      id: 'context-structure-fill',
      type: 'fill',
      source: features,
      minzoom,
      filter: ['all', isPolygon, structure],
      paint: { 'fill-color': colors.structure, 'fill-opacity': 0.7 },
    },
    {
      id: 'context-structure-line',
      type: 'line',
      source: features,
      minzoom,
      filter: ['all', ['!', isPoint], structure],
      paint: { 'line-color': colors.structure, 'line-width': width(3, 6) },
    },
    {
      id: 'context-springs',
      type: 'circle',
      source: features,
      minzoom,
      filter: ['all', isPoint, kindIn('spring', 'intake')],
      // zrodlo pustym kolkiem, ujecie pelnym - rozroznialne bez koloru
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 7],
        'circle-color': ['match', ['get', 'kind'], 'spring', colors.casing, colors.spring],
        'circle-stroke-color': ['match', ['get', 'kind'], 'spring', colors.spring, colors.casing],
        'circle-stroke-width': 2.5,
      },
    },
    {
      id: 'context-structure-marks',
      type: 'symbol',
      source: marks,
      minzoom,
      layout: {
        'icon-image': STRUCTURE_ICON,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 1.1, 16, 1.5],
        'icon-allow-overlap': true,
        // podpis ("jaz") dopiero przy przyblizeniu, w ktorym widac pola - wczesniej sam znak
        'text-field': ['step', ['zoom'], '', 14, ['get', 'label']],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-optional': true,
      },
      paint: { 'text-color': colors.structure, 'text-halo-color': colors.casing, 'text-halo-width': 2 },
    },
  ];
}

function protectedLayers(colors: ContextColors, minzoom: number): LayerSpec[] {
  const { features, outlines } = sourceIds('protected');

  return [
    {
      id: 'context-protected-fill',
      type: 'fill',
      source: features,
      minzoom,
      filter: isPolygon,
      // bez wygladzania: kawalki tego samego obszaru z sasiednich kafli nie maja szczeliny na styku
      paint: { 'fill-color': colors.protected, 'fill-opacity': 0.12, 'fill-antialias': false },
    },
    {
      id: 'context-protected-outline',
      type: 'line',
      source: outlines,
      minzoom,
      filter: ['!', kindIn('natura2000')],
      paint: { 'line-color': colors.protected, 'line-width': 2, 'line-opacity': 0.85 },
    },
    {
      id: 'context-protected-natura',
      type: 'line',
      source: outlines,
      minzoom,
      filter: kindIn('natura2000'),
      paint: {
        'line-color': colors.protected,
        'line-width': 2,
        'line-opacity': 0.85,
        'line-dasharray': [3, 2],
      },
    },
  ];
}

function protectedLabelLayer(colors: ContextColors, minzoom: number): LayerSpec {
  return {
    id: 'context-protected-labels',
    type: 'symbol',
    source: sourceIds('protected').marks,
    minzoom,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Italic'],
      'text-size': 13,
      'text-max-width': 12,
      'text-line-height': 1.25,
      // przy kilku obszarach w jednym miejscu podpis moze stanac obok punktu zamiast znikac
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.8,
    },
    paint: { 'text-color': colors.protectedLabel, 'text-halo-color': colors.casing, 'text-halo-width': 2 },
  };
}

/** Identyfikatory warstw MapLibre jednej warstwy otoczenia (do przelaczania widocznosci). */
export const CONTEXT_LAYER_IDS: Record<ContextLayer, string[]> = {
  cover: ['context-cover-fill', 'context-cover-outline', 'context-cover-rows', 'context-cover-hedges'],
  waterworks: [
    'context-levee-casing',
    'context-levee',
    'context-piped-casing',
    'context-piped',
    'context-structure-fill',
    'context-structure-line',
    'context-springs',
    'context-structure-marks',
  ],
  protected: [
    'context-protected-fill',
    'context-protected-outline',
    'context-protected-natura',
    'context-protected-labels',
  ],
};

/**
 * Zrodla i warstwy otoczenia, poczatkowo ukryte. Obszary chronione i drzewa leza pod `below` (np. pierwsza warstwa
 * rowow - wypelnienia nie zaslaniaja wody), budowle i waly oraz podpisy obszarow na wierzchu w chwili dodania
 * (granice dzialek dodane pozniej przykryja je obrysem).
 */
export function addContextLayers(
  map: MapLibre.Map,
  colors: ContextColors,
  { below, minzoom = 0 }: { below?: string; minzoom?: number } = {},
): void {
  if (!map.hasImage(STRUCTURE_ICON)) {
    map.addImage(STRUCTURE_ICON, structureIcon(colors.structure, colors.casing), { pixelRatio: 2 });
  }

  for (const layer of ['protected', 'cover', 'waterworks'] as const) {
    const ids = sourceIds(layer);

    map.addSource(ids.features, { type: 'geojson', data: EMPTY, attribution: CONTEXT_ATTRIBUTION });
    map.addSource(ids.outlines, { type: 'geojson', data: EMPTY });
    map.addSource(ids.marks, { type: 'geojson', data: EMPTY });
  }

  const hidden = (spec: LayerSpec): LayerSpec => ({
    ...spec,
    layout: { ...('layout' in spec ? spec.layout : {}), visibility: 'none' },
  });

  for (const spec of [...protectedLayers(colors, minzoom), ...coverLayers(colors, minzoom)]) {
    map.addLayer(hidden(spec), below);
  }

  for (const spec of [...waterworksLayers(colors, minzoom), protectedLabelLayer(colors, minzoom)]) {
    map.addLayer(hidden(spec));
  }
}

/** Nowe dane warstwy otoczenia (obiekty, obrysy, znaki). */
export function setContextData(
  map: MapLibre.Map,
  layer: ContextLayer,
  collections: ContextCollections,
): void {
  const ids = sourceIds(layer);

  void map.getSource<MapLibre.GeoJSONSource>(ids.features)?.setData(collections.features);
  void map.getSource<MapLibre.GeoJSONSource>(ids.outlines)?.setData(collections.outlines);

  // podpisy obszarow chronionych liczy mapa dla widoku (`setContextLabels`), znaki budowli przychodza z danymi
  if (layer !== 'protected')
    void map.getSource<MapLibre.GeoJSONSource>(ids.marks)?.setData(collections.marks);
}

/** Podpisy obszarow chronionych dla biezacego widoku (jeden na obszar). */
export function setContextLabels(map: MapLibre.Map, labels: FeatureCollection): void {
  void map.getSource<MapLibre.GeoJSONSource>(sourceIds('protected').marks)?.setData(labels);
}

/** Widocznosc warstw MapLibre jednej warstwy otoczenia. */
export function setContextVisible(map: MapLibre.Map, layer: ContextLayer, visible: boolean): void {
  for (const id of CONTEXT_LAYER_IDS[layer]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
