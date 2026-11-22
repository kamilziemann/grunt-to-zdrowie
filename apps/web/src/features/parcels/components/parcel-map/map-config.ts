// Stale mapy dzialek: zasieg, nazwy zrodel warstw dzialek i kafle granic. Podklady (mapa OpenFreeMap, ortofotomapa
// GUGiK) sa w `@/lib/map-base` - wspolne z mapa w raporcie.
import {
  PARCEL_BOUNDARY_COARSE_ZOOM,
  PARCEL_BOUNDARY_TILE_ZOOM,
  POLAND_BOUNDS,
  type Parcel,
  type ParcelBoundaries,
  type ParcelBoundaryTileZoom,
} from '@app/contracts';
import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, LngLatBoundsLike } from 'maplibre-gl';

// Granice i numery wszystkich dzialek rysujemy sami z danych wektorowych (/api/parcels/boundaries nad WFS ewidencji
// gruntow GUGiK): linie i podpisy sa ostre przy kazdym przyblizeniu i w kolorach aplikacji. Dane pobieramy kaflami
// siatki XYZ i dopiero od przyblizenia 14 - przy widoku gminy czy kraju warstwa nic nie laduje. Ponizej 16 kafle z14
// (kilka zapytan na widok), od 16 drobne kafle z16 tam, gdzie kafel z14 byl obciety albo go nie ma.
export const BOUNDARIES_SOURCE = 'parcel-boundaries';
export const BOUNDARY_LABELS_SOURCE = 'parcel-boundary-labels';
export const BOUNDARIES_ATTRIBUTION = 'Granice działek © GUGiK (EGiB)';
export const BOUNDARIES_MIN_ZOOM = PARCEL_BOUNDARY_COARSE_ZOOM;
/** Numery pojawiaja sie chwile pozniej niz linie - przy mniejszym przyblizeniu zlewalyby sie ze soba. */
export const BOUNDARY_LABELS_MIN_ZOOM = 16.6;
/** Wiecej kafli w widoku = ogromny ekran; nie zasypujemy uslugi zapytaniami (limit dla kafli z16 i z14). */
export const MAX_BOUNDARY_TILES: Record<ParcelBoundaryTileZoom, number> = { 14: 12, 16: 24 };
/** Ile kafli trzymamy w pamieci mapy (starsze spoza widoku wypadaja). */
export const BOUNDARY_TILE_CACHE = 60;
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
  z: ParcelBoundaryTileZoom;
}

/** Klucz kafla w pamieci mapy ("z/x/y"). */
export const boundaryTileKey = (tile: BoundaryTile): string => `${tile.z}/${tile.x}/${tile.y}`;

/** Poziom kafli dla przyblizenia mapy: ponizej 16 grube kafle z14, od 16 drobne z16. */
export function boundaryTileZoom(mapZoom: number): ParcelBoundaryTileZoom {
  return mapZoom < PARCEL_BOUNDARY_TILE_ZOOM ? PARCEL_BOUNDARY_COARSE_ZOOM : PARCEL_BOUNDARY_TILE_ZOOM;
}

/** Kafel z14 zawierajacy kafel z16 (cztery razy dluzszy bok). */
export function coarseParent(tile: BoundaryTile): BoundaryTile {
  const shift = 2 ** (tile.z - PARCEL_BOUNDARY_COARSE_ZOOM);

  return { x: Math.floor(tile.x / shift), y: Math.floor(tile.y / shift), z: PARCEL_BOUNDARY_COARSE_ZOOM };
}

function tileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;

  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/** Kafle siatki granic na poziomie `zoom` pokrywajace prostokat widoku. */
export function boundaryTiles(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom: ParcelBoundaryTileZoom = PARCEL_BOUNDARY_TILE_ZOOM,
): BoundaryTile[] {
  const tiles: BoundaryTile[] = [];

  for (let x = tileX(west, zoom); x <= tileX(east, zoom); x += 1) {
    for (let y = tileY(north, zoom); y <= tileY(south, zoom); y += 1) tiles.push({ x, y, z: zoom });
  }

  return tiles;
}

/** Od tego przyblizenia obciety kafel z14 zastepuja od razu kafle z16 (ponizej zostaje podpowiedz "przybliz"). */
export const BOUNDARY_FINE_FALLBACK_ZOOM = 15;

/** Co wiemy o kaflu: pelny, obciety przez usluge albo nic (jeszcze niepobrany). */
export type BoundaryTileState = 'full' | 'truncated' | undefined;

export interface BoundaryPlan {
  /** kafle do narysowania widoku (pobiera sie tylko te, ktorych nie ma w pamieci) */
  tiles: BoundaryTile[];
  /** klucze kafli, ktore trzymamy w pamieci (widok i ich kafle z14) */
  visible: Set<string>;
  /** w widoku zostaje obciety kafel bez zastepstwa - prosimy o przyblizenie */
  zoomHint: boolean;
}

/**
 * Plan kafli granic dla widoku [zachod, poludnie, wschod, polnoc] przy przyblizeniu `mapZoom`; null = za duzo kafli
 * (ogromny ekran) - nic nie pobieramy. Ponizej 16 kafle z14; obciety kafel z14 (miasto, gesta szachownica) od
 * przyblizenia 15 zastepuja jego kafle z16 w widoku: najwyzej MAX_BOUNDARY_TILES[16], najblizsze punktu `focus`
 * (srodek czesci mapy widocznej obok paneli); gdy czesc widoku zostaje bez granic albo przyblizenie to 14-15,
 * zostaje podpowiedz. Od 16 kafle z16 tam, gdzie pelnego kafla z14 nie ma w pamieci. `state` mowi, co wiemy o kaflu.
 */
export function planBoundaryTiles(
  [west, south, east, north]: readonly [number, number, number, number],
  mapZoom: number,
  state: (key: string) => BoundaryTileState,
  focus: readonly [number, number] = [(west + east) / 2, (south + north) / 2],
): BoundaryPlan | null {
  const zoom = boundaryTileZoom(mapZoom);
  const inView = boundaryTiles(west, south, east, north, zoom);

  if (inView.length > MAX_BOUNDARY_TILES[zoom]) return null;

  if (zoom === PARCEL_BOUNDARY_TILE_ZOOM) {
    return {
      tiles: inView.filter((tile) => state(boundaryTileKey(coarseParent(tile))) !== 'full'),
      visible: new Set(
        inView.flatMap((tile) => [boundaryTileKey(tile), boundaryTileKey(coarseParent(tile))]),
      ),
      zoomHint: false,
    };
  }

  const truncated = new Set(inView.map(boundaryTileKey).filter((key) => state(key) === 'truncated'));
  const coarse = inView.filter((tile) => !truncated.has(boundaryTileKey(tile)));
  const fine =
    truncated.size > 0 && mapZoom >= BOUNDARY_FINE_FALLBACK_ZOOM
      ? boundaryTiles(west, south, east, north, PARCEL_BOUNDARY_TILE_ZOOM).filter((tile) =>
          truncated.has(boundaryTileKey(coarseParent(tile))),
        )
      : [];
  const [focusX, focusY] = [
    tileX(focus[0], PARCEL_BOUNDARY_TILE_ZOOM),
    tileY(focus[1], PARCEL_BOUNDARY_TILE_ZOOM),
  ];
  const nearest = fine
    .toSorted((a, b) => Math.hypot(a.x - focusX, a.y - focusY) - Math.hypot(b.x - focusX, b.y - focusY))
    .slice(0, MAX_BOUNDARY_TILES[PARCEL_BOUNDARY_TILE_ZOOM]);
  const tiles = [...coarse, ...nearest];
  const covered = fine.length > 0 && nearest.length === fine.length;

  return {
    tiles,
    visible: new Set([...inView, ...tiles].map(boundaryTileKey)),
    zoomHint: truncated.size > 0 && !covered,
  };
}

/**
 * Linie granic (poligony) i punkty podpisow z obrysow wielu kafli; dzialka z dwoch kafli wchodzi raz. Kafel obciety
 * przez usluge nie jest rysowany - dziurawa szachownica mylilaby bardziej niz jej brak.
 */
export function outlineCollections(tiles: Iterable<ParcelBoundaries>): {
  lines: FeatureCollection;
  labels: FeatureCollection;
} {
  const seen = new Set<string>();
  const lines: FeatureCollection = { type: 'FeatureCollection', features: [] };
  const labels: FeatureCollection = { type: 'FeatureCollection', features: [] };

  for (const tile of tiles) {
    if (tile.truncated) continue;

    for (const outline of tile.items) {
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

/** Obraz z satelity (kondycja roslin, woda w roslinach) jednej czesci pola: PNG jako data URL i jego zasieg. */
export interface ImageryOverlay {
  image: string;
  /** [zachod, poludnie, wschod, polnoc] */
  bbox: readonly [number, number, number, number];
}

/** Zrodla i warstwy obrazow maja numer po prefiksie (jeden obraz na grupe sasiednich dzialek). */
export const IMAGERY_PREFIX = 'imagery-';
// lekka przezroczystosc: spod obrazu przebija zdjecie lotnicze, a piksele 10-20 m nie udaja ostrosci
export const IMAGERY_PAINT = {
  'raster-opacity': 0.88,
  'raster-resampling': 'linear',
  'raster-fade-duration': 300,
} as const;

/** Narozniki obrazu w kolejnosci MapLibre: lewy gorny, prawy gorny, prawy dolny, lewy dolny. */
export function imageCorners(
  bbox: ImageryOverlay['bbox'],
): [[number, number], [number, number], [number, number], [number, number]] {
  const [west, south, east, north] = bbox;

  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
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
