// Miejsca na polu na mapie ze zdjeciem lotniczym (MapLibre): te same wzory i numery co na szkicu - kropki = suchsze,
// fale = zbiera sie woda, poziome kreski = zaglebienie bez odplywu, linia splywu przerywana. Wzory rysujemy
// piksel po pikselu (bez canvas) z jasna obwodka, zeby byly czytelne na kazdym zdjeciu. Tylko dla `field-map-canvas`.
import type { Zone } from '@app/contracts';
import type { Feature, FeatureCollection } from 'geojson';
import type * as MapLibre from 'maplibre-gl';
import type { DataDrivenPropertyValueSpecification, ExpressionSpecification } from 'maplibre-gl';

import { labelPoint, localProjection } from '@/lib/field-sketch';

export const ZONES_SOURCE = 'zones';
export const ZONE_LABELS_SOURCE = 'zone-labels';

/** Warstwy klikalne (obszar, linia splywu, numer) - klikniecie w inne miejsce mapy zdejmuje wyroznienie. */
export const ZONE_HIT_LAYERS = ['zones-wash', 'zones-path-hit', 'zones-badge'] as const;

export const ZONE_LAYER_IDS = [
  'zones-wash',
  'zones-pattern',
  'zones-casing',
  'zones-outline',
  'zones-path-hit',
  'zones-active',
  'zones-badge',
  'zones-number',
] as const;

type PatternKind = 'drying' | 'collecting' | 'depression';

/** Kolory stale (zdjecie jest jasne w obu motywach): suchsze - pomarancz danych, woda - niebieski danych. */
export interface ZoneColors {
  dry: string;
  water: string;
  halo: string;
  ink: string;
  active: string;
}

export function zoneColors(element: HTMLElement): ZoneColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();

  return {
    dry: token('--data-orange-dark'),
    water: token('--data-blue'),
    halo: token('--map-casing'),
    ink: token('--map-structure'),
    active: token('--map-highlight'),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);

  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Odleglosc punktu kafelka od znaku wzoru (w px logicznych); kafelek powtarza sie, wiec liczymy z zawinieciem. */
type Distance = (x: number, y: number) => number;

/** Odleglosc od kropki w kafelku `size` z zawinieciem (kropka przy brzegu ciagnie sie na sasiedni kafelek). */
function wrapped(x: number, y: number, cx: number, cy: number, size: number): number {
  const dx = Math.min(Math.abs(x - cx), size - Math.abs(x - cx));
  const dy = Math.min(Math.abs(y - cy), size - Math.abs(y - cy));

  return Math.hypot(dx, dy);
}

const PATTERNS: Record<PatternKind, { width: number; height: number; ink: number; distance: Distance }> = {
  // dwie kropki na kafelek 14 px (jak 7 jednostek szkicu, ale wieksze - zdjecie jest drobniejsze niz karta)
  drying: {
    width: 14,
    height: 14,
    ink: 2.4,
    distance: (x, y) => Math.min(wrapped(x, y, 3.5, 3.5, 14), wrapped(x, y, 10.5, 10.5, 14)),
  },
  // fala: sinusoida przez caly kafelek, ciagla po powtorzeniu
  collecting: {
    width: 20,
    height: 12,
    ink: 1,
    distance: (x, y) => Math.abs(y - (6 + 3 * Math.sin((x / 20) * 2 * Math.PI))) * 0.8,
  },
  // poziome kreski - lustro wody
  depression: {
    width: 10,
    height: 9,
    ink: 1.2,
    distance: (_x, y) => Math.abs(y - 4.5),
  },
};

/** Kafelek wzoru: kolor znaku, wokol niego jasna obwodka 1 px, reszta przezroczysta; `ratio` = gestosc pikseli. */
function patternImage(kind: PatternKind, colors: ZoneColors, ratio: number) {
  const spec = PATTERNS[kind];
  const width = spec.width * ratio;
  const height = spec.height * ratio;
  const data = new Uint8Array(width * height * 4);
  const ink = hexToRgb(kind === 'drying' ? colors.dry : colors.water);
  const halo = hexToRgb(colors.halo);

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const distance = spec.distance((px + 0.5) / ratio, (py + 0.5) / ratio);
      const color = distance <= spec.ink ? ink : distance <= spec.ink + 1 ? halo : null;

      if (!color) continue;
      const offset = (py * width + px) * 4;

      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = color === halo ? 200 : 255;
    }
  }

  return { width, height, data };
}

export interface ZoneMark {
  id: string;
  kind: Zone['kind'];
  number: number;
}

/** Obszary i linie miejsc z rodzajem i numerem (wlasciwosci do wzoru, koloru i klikniecia). */
export function zoneCollection(
  marks: readonly ZoneMark[],
  shapes: readonly Pick<Zone, 'id' | 'geometry'>[],
): FeatureCollection {
  const byId = new Map(marks.map((mark) => [mark.id, mark]));

  return {
    type: 'FeatureCollection',
    features: shapes.flatMap((shape): Feature[] => {
      const mark = byId.get(shape.id);

      return mark
        ? [
            {
              type: 'Feature',
              properties: { id: mark.id, kind: mark.kind, number: String(mark.number) },
              geometry: shape.geometry,
            },
          ]
        : [];
    }),
  };
}

/** Punkt na numer miejsca (w srodku obszaru, jak na szkicu; na linii splywu - wierzcholek w polowie). */
export function zoneLabelPosition(geometry: Zone['geometry']): [number, number] {
  if (geometry.type === 'LineString') {
    const middle = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];

    return [middle?.[0] ?? 0, middle?.[1] ?? 0];
  }

  const parts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const origin = parts[0]?.[0]?.[0] ?? [0, 0];
  const project = localProjection(origin);
  const [x, y] = labelPoint(parts.map((part) => part.map((ring) => ring.map(project))));
  const [lng0, lat0] = origin;

  return [lng0 + x / (111_320 * Math.cos((lat0 * Math.PI) / 180)), lat0 + y / 110_540];
}

export function zoneLabelCollection(
  marks: readonly ZoneMark[],
  shapes: readonly Pick<Zone, 'id' | 'geometry'>[],
): FeatureCollection {
  const byId = new Map(marks.map((mark) => [mark.id, mark]));

  return {
    type: 'FeatureCollection',
    features: shapes.flatMap((shape): Feature[] => {
      const mark = byId.get(shape.id);

      return mark
        ? [
            {
              type: 'Feature',
              properties: { id: mark.id, number: String(mark.number) },
              geometry: { type: 'Point', coordinates: zoneLabelPosition(shape.geometry) },
            },
          ]
        : [];
    }),
  };
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
// MapLibre 5+ rozroznia typy wielokrotne, wiec sprawdzamy oba
const AREA: ExpressionSpecification = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const PATH: ExpressionSpecification = [
  'in',
  ['geometry-type'],
  ['literal', ['LineString', 'MultiLineString']],
];

/** Dodaje zrodla i warstwy miejsc (nad polem, pod nic wiecej) - dane ustawia `setZoneData`. */
export function addZoneLayers(map: MapLibre.Map, colors: ZoneColors): void {
  const ratio = Math.min(2, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));

  for (const kind of ['drying', 'collecting', 'depression'] as const) {
    map.addImage(`zone-${kind}`, patternImage(kind, colors, ratio), { pixelRatio: ratio });
  }

  // obrys jak na szkicu: suchsze pomaranczowe, woda niebieska, linia splywu i odcinek profilu grafitowe
  const kindColor: ExpressionSpecification = [
    'match',
    ['get', 'kind'],
    'drying',
    colors.dry,
    ['collecting', 'depression'],
    colors.water,
    colors.ink,
  ];

  map.addSource(ZONES_SOURCE, { type: 'geojson', data: EMPTY });
  map.addSource(ZONE_LABELS_SOURCE, { type: 'geojson', data: EMPTY });
  // jasna mgielka pod wzorem: miejsce odcina sie od zdjecia, wzor jest czytelny na ciemnej roli
  map.addLayer({
    id: 'zones-wash',
    type: 'fill',
    source: ZONES_SOURCE,
    filter: AREA,
    paint: { 'fill-color': colors.halo, 'fill-opacity': 0.28 },
  });
  map.addLayer({
    id: 'zones-pattern',
    type: 'fill',
    source: ZONES_SOURCE,
    filter: ['all', AREA, ['in', ['get', 'kind'], ['literal', ['drying', 'collecting', 'depression']]]],
    paint: { 'fill-pattern': ['concat', 'zone-', ['get', 'kind']] },
  });
  map.addLayer({
    id: 'zones-casing',
    type: 'line',
    source: ZONES_SOURCE,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': colors.halo, 'line-width': ['case', PATH, 6, 4], 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: 'zones-outline',
    type: 'line',
    source: ZONES_SOURCE,
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': kindColor,
      'line-width': ['case', PATH, 3.5, 2],
      'line-dasharray': [2.5, 1.5],
    },
  });
  // szeroka, niewidoczna linia: w linie splywu da sie trafic palcem
  map.addLayer({
    id: 'zones-path-hit',
    type: 'line',
    source: ZONES_SOURCE,
    filter: PATH,
    paint: { 'line-color': colors.halo, 'line-width': 22, 'line-opacity': 0 },
  });
  map.addLayer({
    id: 'zones-active',
    type: 'line',
    source: ZONES_SOURCE,
    filter: ['==', ['get', 'id'], ''],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': colors.active, 'line-width': 4.5 },
  });
  map.addLayer({
    id: 'zones-badge',
    type: 'circle',
    source: ZONE_LABELS_SOURCE,
    paint: {
      'circle-radius': 10,
      'circle-color': colors.ink,
      'circle-stroke-color': colors.halo,
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'zones-number',
    type: 'symbol',
    source: ZONE_LABELS_SOURCE,
    layout: {
      'text-field': ['get', 'number'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': colors.halo },
  });
}

export function setZoneData(
  map: MapLibre.Map,
  marks: readonly ZoneMark[],
  shapes: readonly Pick<Zone, 'id' | 'geometry'>[],
): void {
  void map.getSource<MapLibre.GeoJSONSource>(ZONES_SOURCE)?.setData(zoneCollection(marks, shapes));
  void map.getSource<MapLibre.GeoJSONSource>(ZONE_LABELS_SOURCE)?.setData(zoneLabelCollection(marks, shapes));
}

/** Wyroznienie jednego miejsca (obwodka i kolor numeru), pozostale przygaszone; null = wszystkie jednakowo. */
export function setZoneActive(map: MapLibre.Map, active: string | null, colors: ZoneColors): void {
  const id = active ?? '';
  const dim = (on: number, off: number): DataDrivenPropertyValueSpecification<number> =>
    active === null ? on : ['case', ['==', ['get', 'id'], id], on, off];

  map.setFilter('zones-active', ['==', ['get', 'id'], id]);
  map.setPaintProperty('zones-pattern', 'fill-opacity', dim(1, 0.35));
  map.setPaintProperty('zones-wash', 'fill-opacity', dim(0.28, 0.1));
  map.setPaintProperty('zones-outline', 'line-opacity', dim(1, 0.45));
  map.setPaintProperty(
    'zones-badge',
    'circle-color',
    active === null ? colors.ink : ['case', ['==', ['get', 'id'], id], colors.active, colors.ink],
  );
}

export function setZonesVisible(map: MapLibre.Map, visible: boolean): void {
  for (const id of ZONE_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}
