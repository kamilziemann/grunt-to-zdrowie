// Stale mapy dzialek: zasieg, nazwy zrodel warstw dzialek i kafle granic. Podklady (mapa OpenFreeMap, ortofotomapa
// GUGiK) sa w `@/lib/map-base` - wspolne z mapa w raporcie.
import { PARCEL_BOUNDARY_TILE_ZOOM, POLAND_BOUNDS, type Parcel, type ParcelOutline } from '@app/contracts';
import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, LngLatBoundsLike } from 'maplibre-gl';

// Granice i numery wszystkich dzialek rysujemy sami z danych wektorowych (/api/parcels/boundaries nad WFS ewidencji
// gruntow GUGiK): linie i podpisy sa ostre przy kazdym przyblizeniu i w kolorach aplikacji. Dane pobieramy kaflami
// siatki XYZ i dopiero od duzego przyblizenia - przy widoku gminy czy kraju warstwa nic nie laduje.
export const BOUNDARIES_SOURCE = 'parcel-boundaries';
export const BOUNDARY_LABELS_SOURCE = 'parcel-boundary-labels';
export const BOUNDARIES_ATTRIBUTION = 'Granice działek © GUGiK (EGiB)';
export const BOUNDARIES_MIN_ZOOM = PARCEL_BOUNDARY_TILE_ZOOM;
/** Numery pojawiaja sie chwile pozniej niz linie - przy mniejszym przyblizeniu zlewalyby sie ze soba. */
export const BOUNDARY_LABELS_MIN_ZOOM = 16.6;
/** Wiecej kafli w widoku = za male przyblizenie albo ogromny ekran; nie zasypujemy uslugi zapytaniami. */
export const MAX_BOUNDARY_TILES = 24;
/** Ile kafli trzymamy w pamieci mapy (starsze spoza widoku wypadaja). */
export const BOUNDARY_TILE_CACHE = 80;
/** Niewidoczne wypelnienie dzialek z warstwy granic: cel klikniecia i podswietlenie pod kursorem. */
export const BOUNDARY_HIT_LAYER = 'parcel-boundaries-hit';

/** Dzialka na mapie: tyle wystarcza do narysowania obrysu (pelny opis dociaga panel). */
export type MapParcel = Pick<Parcel, 'id' | 'number' | 'geometry'>;

export const BOUNDARY_LAYER_IDS = [
  BOUNDARY_HIT_LAYER,
  'parcel-boundaries-casing',
  'parcel-boundaries-line',
  'parcel-boundary-labels',
];

export interface BoundaryTile {
  x: number;
  y: number;
}

function tileX(lng: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** PARCEL_BOUNDARY_TILE_ZOOM);
}

function tileY(lat: number): number {
  const rad = (lat * Math.PI) / 180;

  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** PARCEL_BOUNDARY_TILE_ZOOM,
  );
}

/** Kafle siatki granic pokrywajace prostokat widoku. */
export function boundaryTiles(west: number, south: number, east: number, north: number): BoundaryTile[] {
  const tiles: BoundaryTile[] = [];

  for (let x = tileX(west); x <= tileX(east); x += 1) {
    for (let y = tileY(north); y <= tileY(south); y += 1) tiles.push({ x, y });
  }

  return tiles;
}

/** Linie granic (poligony) i punkty podpisow z obrysow wielu kafli; dzialka z dwoch kafli wchodzi raz. */
export function outlineCollections(tiles: Iterable<readonly ParcelOutline[]>): {
  lines: FeatureCollection;
  labels: FeatureCollection;
} {
  const seen = new Set<string>();
  const lines: FeatureCollection = { type: 'FeatureCollection', features: [] };
  const labels: FeatureCollection = { type: 'FeatureCollection', features: [] };

  for (const outlines of tiles) {
    for (const outline of outlines) {
      if (seen.has(outline.id)) continue;

      seen.add(outline.id);
      lines.features.push({ type: 'Feature', properties: { id: outline.id }, geometry: outline.geometry });
      labels.features.push({
        type: 'Feature',
        properties: { id: outline.id, number: outline.number },
        geometry: { type: 'Point', coordinates: outline.center },
      });
    }
  }

  return { lines, labels };
}

/** Warstwy podkladu z ikonami punktow (parkingi, apteki, przystanki) - na mapie pol tylko przeszkadzaja. */
export const isPoiLayer = (id: string): boolean => id.startsWith('poi');

/** Nazwa miejsca po polsku, a gdy jej nie ma - nazwa lokalna z OpenStreetMap. */
export const LOCAL_NAME: ExpressionSpecification = ['coalesce', ['get', 'name:pl'], ['get', 'name']];

export const SELECTED_SOURCE = 'parcels-selected';
export const PREVIEW_SOURCE = 'parcel-preview';
/** Szkic wlasnego pola (D3): obszary, linia podzialu albo otwarty obrys i stukniete punkty. */
export const DRAW_SOURCE = 'field-draw';

/** Warstwa szkicu wlasnego pola: role obszarow w `properties.role`, linia i punkty w `properties.kind`. */
export function drawingCollection(drawing: {
  areas: readonly { ring: readonly [number, number][]; role: string }[];
  line: readonly [number, number][] | null;
  points: readonly [number, number][];
}): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      ...drawing.areas.map((area) => ({
        type: 'Feature' as const,
        properties: { kind: 'area', role: area.role },
        geometry: { type: 'Polygon' as const, coordinates: [[...area.ring, ...area.ring.slice(0, 1)]] },
      })),
      ...(drawing.line
        ? [
            {
              type: 'Feature' as const,
              properties: { kind: 'line' },
              geometry: { type: 'LineString' as const, coordinates: [...drawing.line] },
            },
          ]
        : []),
      ...drawing.points.map((point) => ({
        type: 'Feature' as const,
        properties: { kind: 'point' },
        geometry: { type: 'Point' as const, coordinates: [...point] },
      })),
    ],
  };
}

/** Ponizej tego przyblizenia klikniecie jest zbyt niedokladne, zeby wskazac dzialke. */
export const MIN_PICK_ZOOM = 13;

export const INITIAL_BOUNDS: LngLatBoundsLike = [
  [POLAND_BOUNDS.west, POLAND_BOUNDS.south],
  [POLAND_BOUNDS.east, POLAND_BOUNDS.north],
];

/** Mapa nie odjezdza daleko poza Polske (zapas na panele zaslaniajace krawedzie). */
export const MAX_BOUNDS: LngLatBoundsLike = [
  [POLAND_BOUNDS.west - 6, POLAND_BOUNDS.south - 4],
  [POLAND_BOUNDS.east + 6, POLAND_BOUNDS.north + 4],
];

export function parcelCollection(parcels: readonly MapParcel[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parcels.map((parcel) => ({
      type: 'Feature',
      id: parcel.id,
      properties: { id: parcel.id, number: parcel.number },
      geometry: parcel.geometry,
    })),
  };
}
