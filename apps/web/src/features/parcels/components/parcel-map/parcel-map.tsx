// Mapa dzialek na MapLibre GL. Biblioteka i WebGL istnieja tylko w przegladarce, wiec modul mapy laduje sie leniwie
// w efekcie (osobny chunk, nic w SSR). Jeden styl na cale zycie mapy: ortofotomapa to warstwa rastrowa z
// przelaczana widocznoscia, a nie `setStyle` - dzieki temu zaznaczone dzialki nie znikaja przy zmianie podkladu.
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  CONTEXT_LAYERS,
  type ContextLayer,
  type ContextTile,
  type HydroTile,
  type ParcelBoundaries,
  type ParcelBoundaryTileZoom,
  type ParcelOutline,
} from '@app/contracts';
import { LoaderCircle } from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  addContextLayers,
  areaLabels,
  CONTEXT_TILE_CACHE,
  contextCollections,
  contextColors,
  ContextUnavailableError,
  latestContextImport,
  setContextData,
  setContextLabels,
  setContextVisible,
  type ContextKindLabels,
} from '@/lib/context-map';
import {
  addHydroLayers,
  HYDRO_MIN_ZOOM,
  HYDRO_TILE_CACHE,
  hydroCollections,
  hydroColors,
  hydroTiles,
  HYDRO_LAYER_IDS,
  HydroUnavailableError,
  latestImport,
  MAX_HYDRO_TILES,
  setHydroData,
  setHydroVisible,
} from '@/lib/hydro-map';
import { BASEMAP_STYLE_URL, loadMapLibre, ORTHO_LAYER, ORTHO_SOURCE } from '@/lib/map-base';
import { createTileLayer, type TileLayer, type TileLayerState, type TileView } from '@/lib/map-tiles';
import { cn } from '@/lib/utils/cn';

import { readCamera, saveCamera } from './camera-memory';
import { createMapControls, type LocateState, type MapControls } from './map-controls';
import {
  BOUNDARIES_ATTRIBUTION,
  BOUNDARIES_MIN_ZOOM,
  BOUNDARIES_SOURCE,
  BOUNDARY_HIT_LAYER,
  BOUNDARY_LABELS_MIN_ZOOM,
  BOUNDARY_LABELS_SOURCE,
  BOUNDARY_LAYER_IDS,
  BOUNDARY_TILE_CACHE,
  boundaryTileKey,
  type BoundaryTileState,
  DRAW_SOURCE,
  drawingCollection,
  IMAGERY_PAINT,
  IMAGERY_PREFIX,
  imageCorners,
  INITIAL_BOUNDS,
  isPoiLayer,
  LOCAL_NAME,
  MAX_BOUNDS,
  MIN_PICK_ZOOM,
  outlineCollections,
  type MapParcel,
  parcelCollection,
  planBoundaryTiles,
  PREVIEW_SOURCE,
  SELECTED_SOURCE,
  type ImageryOverlay,
} from './map-config';

export type { ImageryOverlay, MapParcel };
export type Basemap = 'map' | 'ortho';
export type MapPadding = MapLibre.PaddingOptions;

export interface MapFocus {
  /** [zachod, poludnie, wschod, polnoc] */
  bbox: [number, number, number, number];
  /** zmiana klucza = nowy dojazd (ten sam klucz nie rusza mapy, np. po przerysowaniu komponentu) */
  key: string;
  /** dojazd tylko wtedy, gdy obszaru nie widac w calosci (np. "pokaz moje dzialki") - kadr uzytkownika zostaje */
  soft?: boolean;
}

/** Szkic wlasnego pola rysowany nad dzialkami (wspolrzedne [dlugosc, szerokosc]). */
export interface MapDrawing {
  areas: readonly { ring: readonly [number, number][]; role: 'chosen' | 'other' | 'draft' }[];
  line: readonly [number, number][] | null;
  points: readonly [number, number][];
}

export interface ParcelMapLabels {
  map: string;
  loading: string;
  failed: string;
  zoomIn: string;
  zoomOut: string;
  locate: string;
  locateUnavailable: string;
  attribution: string;
  /** wskaznik na dole mapy, gdy w tle dociagaja sie granice dzialek */
  loadingBoundaries: string;
  /** wskaznik, gdy dociagaja sie rowy i cieki */
  loadingHydro: string;
  /** wskaznik, gdy dociagaja sie warstwy otoczenia pola */
  loadingContext: string;
  /** podpowiedz, gdy kafel granic byl obciety przez usluge (miasto, gesta szachownica) */
  zoomForBoundaries: string;
}

/**
 * Stan warstwy z kafli BDOT10k (rowy i cieki, otoczenie pola) dla legendy: `zoom` = za male przyblizenie (nic nie
 * pobieramy), `unavailable` = API odpowiada 404/502/503 (trasa jeszcze nie wdrozona albo baza nie odpowiada).
 */
export interface LayerStatus {
  state: TileLayerState;
  /** data importu BDOT10k z pobranych kafli */
  importedAt: string | null;
  /** ktorys kafel byl przyciety do limitu obiektow */
  truncated: boolean;
}

export type HydroStatus = LayerStatus;

/** Wlaczone warstwy otoczenia pola. */
export type ContextVisibility = Readonly<Record<ContextLayer, boolean>>;

export interface ParcelMapProps {
  /** dzialki z listy "moje dzialki" */
  selected: readonly MapParcel[];
  /** dzialka ogladana przed dodaniem */
  preview?: MapParcel | null;
  /** szkic wlasnego pola (tryb rysowania); null = brak */
  drawing?: MapDrawing | null;
  basemap?: Basemap;
  /** granice i numery wszystkich dzialek (widoczne i pobierane dopiero w duzym przyblizeniu) */
  boundaries?: boolean;
  /** obrysy dzialek w kaflu siatki granic (poziom 14 albo 16); brak = mapa bez warstwy granic */
  loadBoundaries?: (x: number, y: number, z: ParcelBoundaryTileZoom) => Promise<ParcelBoundaries>;
  /** rowy, cieki, wody i mokradla z BDOT10k (pobierane od przyblizenia HYDRO_MIN_ZOOM) */
  hydro?: boolean;
  /** kafel hydrografii; brak = mapa bez tej warstwy */
  loadHydro?: (x: number, y: number) => Promise<HydroTile>;
  /** zmiana stanu warstwy hydrografii (legenda, komunikat o niedostepnosci) */
  onHydroStatus?: (status: HydroStatus) => void;
  /** warstwy otoczenia pola: drzewa, budowle wodne i waly, obszary chronione (pobierane dopiero po wlaczeniu) */
  context?: ContextVisibility;
  /** kafel warstwy otoczenia; brak = mapa bez tych warstw */
  loadContext?: (layer: ContextLayer, x: number, y: number) => Promise<ContextTile>;
  onContextStatus?: (layer: ContextLayer, status: LayerStatus) => void;
  /** podpisy na mapie: rodzaj budowli ("jaz") i rodzaj obszaru chronionego */
  contextLabels?: ContextKindLabels;
  /** obrazy z satelity (kondycja roslin, woda w roslinach) pod rowami i obrysem dzialek; pusta lista = brak */
  imagery?: readonly ImageryOverlay[];
  focus?: MapFocus | null;
  /**
   * Margines na panele zaslaniajace mape, liczony w chwili dojazdu (uklad zalezy od szerokosci okna i polozenia
   * arkusza) - dzialka po dojezdzie ma byc widoczna obok paneli, a nie pod nimi.
   */
  getPadding?: () => MapPadding;
  /** false = mapa pogladowa bez gestow i klikania */
  interactive?: boolean;
  /**
   * Start od widoku calej Polski zamiast ostatniego kadru z pamieci karty - pusta mapa ("Nie znam numeru"), na
   * ktorej rolnik dopiero szuka swojej wsi. Czytane raz, przy tworzeniu mapy.
   */
  startFromCountry?: boolean;
  /**
   * Dzialki jeszcze sie wczytuja: mapa, ktora wystartowala z widoku calej Polski (brak kadru w pamieci), zostaje
   * zasloneta obrysem-zastepnikiem, zamiast pokazywac kraj przez kilka sekund. Gdy przyjdzie dojazd albo blad -
   * wywolujacy daje `false`.
   */
  awaitFocus?: boolean;
  /**
   * Klikniecie w mape. `outline` = dzialka z warstwy granic pod kursorem (znana od razu, bez pytania API);
   * brak = warstwa wylaczona albo jeszcze niepobrana - wtedy dzialke trzeba znalezc po punkcie.
   */
  onPick?: (lng: number, lat: number, outline?: ParcelOutline) => void;
  /** dodatkowy komunikat wskaznika na dole mapy (np. "wczytuje dane dzialki"); null = tylko granice */
  status?: string | null;
  /** pozycja wskaznika, gdy czesc mapy zaslania panel */
  statusClassName?: string;
  /** klikniecie przy zbyt malym przyblizeniu (mapa sama przybliza, wywolujacy pokazuje podpowiedz) */
  onZoomTooLow?: () => void;
  /**
   * Polecenia dla wlasnych przyciskow ekranu (przybliz, oddal, gdzie jestem) po zaladowaniu mapy; null po jej
   * usunieciu. Mapa interaktywna nie ma domyslnych przyciskow MapLibre - rysuje je wywolujacy.
   */
  onControls?: (controls: MapControls | null) => void;
  /** stan szukania polozenia (przycisk "Gdzie jestem" i komunikat) */
  onLocateState?: (state: LocateState) => void;
  labels: ParcelMapLabels;
  /** co pokazac, zanim mapa sie wczyta (np. obrys dzialki z geometrii); brak = sam napis "Wczytuje mape" */
  placeholder?: ReactNode;
  className?: string;
}

type MapState = 'loading' | 'ready' | 'failed';

const DEFAULT_PADDING: MapPadding = { top: 48, right: 48, bottom: 48, left: 48 };
/**
 * Ponizej tego przyblizenia kadr to "widok z daleka" (kraj, wojewodztwo), a nie wybor uzytkownika: dzialka
 * "widoczna" na takim kadrze to kropka, wiec dojazd do niej jedzie zawsze - takze z kadru zapamietanego z pustej mapy.
 */
const FAR_ZOOM = 10;
const defaultPadding = () => DEFAULT_PADDING;
const NO_IMAGERY: readonly ImageryOverlay[] = [];
// Kafle z14 obciete przez usluge (klucze "14/x/y"), pamietane przez cala sesje karty, takze po wyjsciu z mapy i powrocie:
// o taki kafel nie pytamy drugi raz (w miescie to ok. 290 kB na marne), od przyblizenia 15 od razu kafle z16.
const truncatedCoarseTiles = new Set<string>();
const NO_CONTEXT: ContextVisibility = { cover: false, waterworks: false, protected: false };
const NO_LABELS: ContextKindLabels = {};
const noop = (): void => undefined;
// dojazd do dzialki: blizej nie ma sensu (kafle zdjecia lotniczego koncza sie na ok. 19, dzialka i tak wypelnia ekran)
const FOCUS_MAX_ZOOM = 17;

function viewOf(map: MapLibre.Map): TileView {
  const bounds = map.getBounds();

  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
    zoom: map.getZoom(),
  };
}

interface TileLayers {
  hydro: TileLayer<HydroTile>;
  context: ReadonlyMap<ContextLayer, TileLayer<ContextTile>>;
}

/**
 * Czesc mapy widoczna obok paneli ([zachod, poludnie, wschod, polnoc]): na komputerze panel zaslania lewa strone, na
 * telefonie arkusz dol. Margines z jednej strony najwyzej pol mapy.
 */
function visibleBounds(map: MapLibre.Map, padding: MapPadding): [number, number, number, number] {
  const { top, right, bottom, left, width, height } = visibleInsets(map, padding);
  const corner = map.unproject([left, top]);
  const opposite = map.unproject([width - right, height - bottom]);

  return [corner.lng, opposite.lat, opposite.lng, corner.lat];
}

function visibleInsets(map: MapLibre.Map, padding: MapPadding) {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const inset = (from: number | undefined, size: number) => Math.min(Math.max(from ?? 0, 0), size / 2);

  return {
    top: inset(padding.top, height),
    right: inset(padding.right, width),
    bottom: inset(padding.bottom, height),
    left: inset(padding.left, width),
    width,
    height,
  };
}

/**
 * Czy obszar widac w calosci obok paneli. Po dojezdzie obszar dotyka marginesu co do piksela, wiec liczymy z polowa
 * marginesu - inaczej blad zaokraglenia albo inny o kilka pikseli panel uruchamialby dojazd od nowa.
 */
function showsArea(map: MapLibre.Map, padding: MapPadding, bbox: readonly [number, number, number, number]) {
  const { top, right, bottom, left, width, height } = visibleInsets(map, padding);
  const corner = map.project([bbox[0], bbox[3]]);
  const opposite = map.project([bbox[2], bbox[1]]);

  return (
    corner.x >= left / 2 &&
    corner.y >= top / 2 &&
    opposite.x <= width - right / 2 &&
    opposite.y <= height - bottom / 2
  );
}

/** Srodek czesci mapy widocznej obok paneli - to on jest "kadrem" przenoszonym miedzy mapami. */
function visibleCenter(map: MapLibre.Map, padding: MapPadding): [number, number] {
  const { top, right, bottom, left, width, height } = visibleInsets(map, padding);
  const center = map.unproject([(left + width - right) / 2, (top + height - bottom) / 2]);

  return [center.lng, center.lat];
}

/** Ustawia mape tak, zeby `center` stal na srodku czesci widocznej obok paneli (bez animacji). */
function jumpToVisibleCenter(map: MapLibre.Map, padding: MapPadding, center: [number, number], zoom: number) {
  const { top, right, bottom, left, width, height } = visibleInsets(map, padding);

  map.jumpTo({ center, zoom });

  const shift = map.unproject([width / 2 - (left - right) / 2, height / 2 - (top - bottom) / 2]);

  map.jumpTo({ center: shift });
}

function statusKey(status: LayerStatus): string {
  return `${status.state}|${status.importedAt ?? ''}|${String(status.truncated)}`;
}

function token(element: HTMLElement, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/** Warstwy aplikacji na gotowym stylu podkladu: ortofotomapa pod etykietami, na wierzchu dzialki. */
function addAppLayers(map: MapLibre.Map, container: HTMLElement): void {
  const symbols = map.getStyle().layers.filter((layer) => layer.type === 'symbol');

  // Podklad podpisuje miejsca po angielsku ("Poland", "Warsaw") - rolnik ma widziec polskie nazwy.
  for (const layer of symbols) {
    if (isPoiLayer(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');

      continue;
    }

    if (JSON.stringify(layer.layout?.['text-field'] ?? '').includes('name')) {
      map.setLayoutProperty(layer.id, 'text-field', LOCAL_NAME);
    }
  }

  // Zdjecie lotnicze pod etykietami podkladu: nazwy miejscowosci i drog zostaja czytelne.
  map.addSource(ORTHO_SOURCE.id, ORTHO_SOURCE.spec);
  map.addLayer({ ...ORTHO_LAYER, layout: { visibility: 'none' } }, symbols[0]?.id);

  const casing = token(container, '--map-casing');
  const empty = parcelCollection([]);

  // Rowy i cieki nad podkladem i zdjeciem, pod granicami dzialek (obrys pola zostaje na wierzchu).
  addHydroLayers(map, hydroColors(container), { minzoom: HYDRO_MIN_ZOOM - 1 });
  // Otoczenie pola: wypelnienia (lasy, obszary chronione) pod rowami, budowle i waly nad nimi, pod granicami.
  addContextLayers(map, contextColors(container), { below: HYDRO_LAYER_IDS[0], minzoom: HYDRO_MIN_ZOOM - 1 });

  // Granice i numery wszystkich dzialek nad podkladem i zdjeciem, pod zaznaczeniami uzytkownika.
  map.addSource(BOUNDARIES_SOURCE, {
    type: 'geojson',
    data: empty,
    attribution: BOUNDARIES_ATTRIBUTION,
    // identyfikator dzialki jako id obiektu: stan "pod kursorem" ustawiamy po nim
    promoteId: 'id',
  });
  map.addSource(BOUNDARY_LABELS_SOURCE, { type: 'geojson', data: empty });
  map.addLayer({
    id: BOUNDARY_HIT_LAYER,
    type: 'fill',
    source: BOUNDARIES_SOURCE,
    minzoom: BOUNDARIES_MIN_ZOOM,
    paint: {
      'fill-color': token(container, '--map-boundary'),
      'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.16, 0],
    },
  });
  map.addLayer({
    id: 'parcel-boundaries-casing',
    type: 'line',
    source: BOUNDARIES_SOURCE,
    minzoom: BOUNDARIES_MIN_ZOOM,
    // przy przyblizeniu 14-16 linii jest duzo - ciensze i bledsze, zeby nie zalaly zdjecia
    paint: {
      'line-color': casing,
      'line-width': ['interpolate', ['linear'], ['zoom'], BOUNDARIES_MIN_ZOOM, 2, 16, 3.5],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], BOUNDARIES_MIN_ZOOM, 0.5, 16, 0.7],
    },
  });
  map.addLayer({
    id: 'parcel-boundaries-line',
    type: 'line',
    source: BOUNDARIES_SOURCE,
    minzoom: BOUNDARIES_MIN_ZOOM,
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': token(container, '--map-boundary'),
      'line-width': ['interpolate', ['linear'], ['zoom'], BOUNDARIES_MIN_ZOOM, 0.6, 16, 1, 19, 2],
    },
  });
  map.addLayer({
    id: 'parcel-boundary-labels',
    type: 'symbol',
    source: BOUNDARY_LABELS_SOURCE,
    minzoom: BOUNDARY_LABELS_MIN_ZOOM,
    layout: {
      'text-field': ['get', 'number'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], BOUNDARY_LABELS_MIN_ZOOM, 11, 18, 13.5, 20, 16],
      'text-padding': 3,
    },
    paint: {
      'text-color': token(container, '--map-boundary-label'),
      'text-halo-color': casing,
      'text-halo-width': 2,
    },
  });

  for (const [id, color, dashed] of [
    [SELECTED_SOURCE, token(container, '--map-selected'), false],
    [PREVIEW_SOURCE, token(container, '--map-preview'), true],
  ] as const) {
    map.addSource(id, { type: 'geojson', data: parcelCollection([]) });
    map.addLayer({
      id: `${id}-fill`,
      type: 'fill',
      source: id,
      paint: { 'fill-color': color, 'fill-opacity': 0.22 },
    });
    // biala podkladka pod obrysem: granica dzialki jest czytelna i na mapie, i na zdjeciu
    map.addLayer({
      id: `${id}-casing`,
      type: 'line',
      source: id,
      paint: { 'line-color': casing, 'line-width': 5, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: `${id}-line`,
      type: 'line',
      source: id,
      paint: {
        'line-color': color,
        'line-width': 2.5,
        ...(dashed ? { 'line-dasharray': [2, 1.5] } : {}),
      },
    });
  }

  // Szkic wlasnego pola na samej gorze: wybrana czesc kolorem zaznaczenia, druga czesc wyszarzona, szkic przerywany.
  const chosen = token(container, '--map-selected');
  const draft = token(container, '--map-preview');
  const other = token(container, '--map-boundary');

  map.addSource(DRAW_SOURCE, { type: 'geojson', data: parcelCollection([]) });
  map.addLayer({
    id: `${DRAW_SOURCE}-fill`,
    type: 'fill',
    source: DRAW_SOURCE,
    filter: ['==', ['get', 'kind'], 'area'],
    paint: {
      'fill-color': ['match', ['get', 'role'], 'chosen', chosen, 'other', other, draft],
      'fill-opacity': ['match', ['get', 'role'], 'other', 0.08, 0.3],
    },
  });
  map.addLayer({
    id: `${DRAW_SOURCE}-outline`,
    type: 'line',
    source: DRAW_SOURCE,
    filter: ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'role'], 'chosen']],
    paint: { 'line-color': chosen, 'line-width': 3 },
  });
  map.addLayer({
    id: `${DRAW_SOURCE}-line`,
    type: 'line',
    source: DRAW_SOURCE,
    filter: ['==', ['get', 'kind'], 'line'],
    paint: { 'line-color': draft, 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
  });
  map.addLayer({
    id: `${DRAW_SOURCE}-points`,
    type: 'circle',
    source: DRAW_SOURCE,
    filter: ['==', ['get', 'kind'], 'point'],
    paint: {
      'circle-radius': 6,
      'circle-color': draft,
      'circle-stroke-color': casing,
      'circle-stroke-width': 2,
    },
  });
}

export function ParcelMap({
  selected,
  preview = null,
  drawing = null,
  basemap = 'map',
  boundaries = true,
  loadBoundaries,
  hydro = false,
  loadHydro,
  onHydroStatus,
  context = NO_CONTEXT,
  loadContext,
  onContextStatus,
  contextLabels = NO_LABELS,
  imagery = NO_IMAGERY,
  focus = null,
  getPadding = defaultPadding,
  interactive = true,
  startFromCountry = false,
  awaitFocus = false,
  onPick,
  onZoomTooLow,
  onControls,
  onLocateState,
  status = null,
  statusClassName,
  labels,
  placeholder,
  className,
}: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const focusedKeyRef = useRef<string | null>(null);
  const imageryCountRef = useRef(0);
  const [state, setState] = useState<MapState>('loading');
  const [boundariesLoading, setBoundariesLoading] = useState(false);
  // w widoku jest kafel z14 obciety przez usluge - granic tam nie rysujemy, prosimy o przyblizenie
  const [boundariesTruncated, setBoundariesTruncated] = useState(false);
  // warstwy z kafli BDOT10k w trakcie pobierania (wskaznik na dole mapy)
  const [tilesLoading, setTilesLoading] = useState<ReadonlySet<string>>(() => new Set());
  // Najnowsze wartosci dla zdarzen mapy, ktora powstaje raz - bez przepinania sluchaczy przy kazdym renderze.
  const latest = useRef({
    focus,
    drawing,
    onPick,
    onZoomTooLow,
    onControls,
    onLocateState,
    getPadding,
    labels,
    boundaries,
    loadBoundaries,
    hydro,
    loadHydro,
    onHydroStatus,
    context,
    loadContext,
    onContextStatus,
    contextLabels,
  });
  // Obrysy pobrane kaflami siatki granic: klucz "z/x/y" -> kafel; kolejnosc wpisow = kolejnosc pobrania.
  const boundaryTilesRef = useRef(new Map<string, ParcelBoundaries>());
  const pendingTilesRef = useRef(new Set<string>());
  // ostatnio zgloszony stan kazdej warstwy z kafli - zglaszamy tylko zmiany
  const reportedRef = useRef(new Map<string, string>());
  const tileLayersRef = useRef<TileLayers | null>(null);
  // zdejmuje podswietlenie "pod kursorem" (ustawiane w zdarzeniach mapy) - przy wejsciu w tryb rysowania
  const clearHoverRef = useRef<() => void>(noop);
  // pierwszy dojazd swiezej mapy bez animacji: mapa nie przelatuje z widoku kraju ani z poprzedniego kadru
  const firstFocusRef = useRef(true);
  const startFromCountryRef = useRef(startFromCountry);
  // mapa powstala w widoku calej Polski (bez kadru i bez dzialki) - do pierwszego dojazdu zaslaniamy ja
  const [countryStart, setCountryStart] = useState(false);
  // mapa stoi w startowym widoku calej Polski (nikt go nie wybral) - wtedy nawet miekki dojazd jedzie do dzialki
  const countryViewRef = useRef(false);

  useEffect(() => {
    latest.current = {
      focus,
      drawing,
      onPick,
      onZoomTooLow,
      onControls,
      onLocateState,
      getPadding,
      labels,
      boundaries,
      loadBoundaries,
      hydro,
      loadHydro,
      onHydroStatus,
      context,
      loadContext,
      onContextStatus,
      contextLabels,
    };
  });

  /** Stan warstwy z kafli: zglasza go wywolujacemu (tylko zmiany) i prowadzi wskaznik ladowania. */
  const report = useCallback(
    (
      name: string,
      layerState: TileLayerState,
      tiles: readonly (HydroTile | ContextTile)[],
      importedAt: string | null,
      notify: (next: LayerStatus) => void,
    ) => {
      const next: LayerStatus = {
        state: layerState,
        importedAt,
        truncated: tiles.some((tile) => tile.truncated),
      };
      const key = statusKey(next);

      setTilesLoading((current) => {
        if (current.has(name) === (layerState === 'loading')) return current;

        const loading = new Set(current);

        if (layerState === 'loading') loading.add(name);
        else loading.delete(name);

        return loading;
      });

      if (reportedRef.current.get(name) === key) return;

      reportedRef.current.set(name, key);
      notify(next);
    },
    [],
  );

  /** Podpisy obszarow chronionych dla widoku: jeden na obszar, w kawalku, ktory zajmuje najwiecej widoku. */
  const relabelProtected = useCallback((tiles: readonly ContextTile[]) => {
    const map = mapRef.current;

    if (!map || !latest.current.context.protected) return;

    // podpis ma stanac w czesci mapy widocznej obok paneli, a nie pod nimi
    setContextLabels(
      map,
      areaLabels(tiles, visibleBounds(map, latest.current.getPadding()), latest.current.contextLabels),
    );
  }, []);

  /** Warstwy z kafli tworzone przy pierwszym uzyciu (w efekcie albo zdarzeniu mapy, nigdy w renderze). */
  const tileLayers = useCallback((): TileLayers => {
    if (tileLayersRef.current) return tileLayersRef.current;

    const hydroLayer = createTileLayer<HydroTile>({
      tilesFor: hydroTiles,
      load: (x, y) => latest.current.loadHydro?.(x, y) ?? Promise.reject(new HydroUnavailableError(404)),
      minZoom: HYDRO_MIN_ZOOM,
      maxTiles: MAX_HYDRO_TILES,
      cacheSize: HYDRO_TILE_CACHE,
      isUnavailable: (error) => error instanceof HydroUnavailableError,
      onData: (tiles) => {
        if (mapRef.current)
          setHydroData(mapRef.current, hydroCollections(tiles.map((tile) => tile.features)));
      },
      onState: (layerState, tiles) =>
        report('hydro', layerState, tiles, latestImport(tiles), (next) =>
          latest.current.onHydroStatus?.(next),
        ),
    });
    const contextLayers = new Map(
      CONTEXT_LAYERS.map((layer) => {
        const tileLayer = createTileLayer<ContextTile>({
          tilesFor: hydroTiles,
          load: (x, y) =>
            latest.current.loadContext?.(layer, x, y) ?? Promise.reject(new ContextUnavailableError(404)),
          minZoom: HYDRO_MIN_ZOOM,
          maxTiles: MAX_HYDRO_TILES,
          cacheSize: CONTEXT_TILE_CACHE,
          isUnavailable: (error) => error instanceof ContextUnavailableError,
          onData: (tiles) => {
            if (!mapRef.current) return;

            setContextData(mapRef.current, layer, contextCollections(tiles, latest.current.contextLabels));

            if (layer === 'protected') relabelProtected(tiles);
          },
          onState: (layerState, tiles) =>
            report(`context-${layer}`, layerState, tiles, latestContextImport(tiles), (next) =>
              latest.current.onContextStatus?.(layer, next),
            ),
        });

        return [layer, tileLayer] as const;
      }),
    );

    tileLayersRef.current = { hydro: hydroLayer, context: contextLayers };

    return tileLayersRef.current;
  }, [report, relabelProtected]);

  /** Dociaga rowy i cieki dla widoku: tylko przy wlaczonej warstwie i od przyblizenia, przy ktorym widac pola. */
  const refreshHydro = useCallback(() => {
    const map = mapRef.current;
    const { hydro: enabled, loadHydro: load } = latest.current;

    tileLayers().hydro.refresh(map && enabled && load ? viewOf(map) : null);
  }, [tileLayers]);

  /** Dociaga wlaczone warstwy otoczenia dla widoku i przelicza podpisy obszarow chronionych. */
  const refreshContext = useCallback(() => {
    const map = mapRef.current;
    const { context: enabled, loadContext: load } = latest.current;
    const { context: layers } = tileLayers();

    for (const [layer, tileLayer] of layers) {
      tileLayer.refresh(map && enabled[layer] && load ? viewOf(map) : null);
    }

    relabelProtected(layers.get('protected')?.tiles() ?? []);
  }, [tileLayers, relabelProtected]);

  /**
   * Dociaga granice dla widoku - tylko gdy warstwa jest wlaczona i od przyblizenia 14. Ponizej 16 grube kafle z14;
   * od 16 drobne kafle z16, ale tylko tam, gdzie pelnego kafla z14 nie ma w pamieci (obciety albo niepobrany).
   */
  const refreshBoundaries = useCallback(function refresh() {
    const map = mapRef.current;
    const { boundaries: enabled, loadBoundaries: load } = latest.current;
    const cache = boundaryTilesRef.current;
    const pending = pendingTilesRef.current;

    if (!map || !enabled || !load || map.getZoom() < BOUNDARIES_MIN_ZOOM) {
      setBoundariesTruncated(false);

      return;
    }

    const { west, south, east, north } = viewOf(map);
    const tileState = (key: string): BoundaryTileState => {
      const tile = cache.get(key);

      if (tile) return tile.truncated ? 'truncated' : 'full';

      return truncatedCoarseTiles.has(key) ? 'truncated' : undefined;
    };
    // kafle z16 zastepujace obciety kafel z14 ida od srodka czesci mapy widocznej obok paneli
    const [visibleWest, visibleSouth, visibleEast, visibleNorth] = visibleBounds(
      map,
      latest.current.getPadding(),
    );
    const plan = planBoundaryTiles([west, south, east, north], map.getZoom(), tileState, [
      (visibleWest + visibleEast) / 2,
      (visibleSouth + visibleNorth) / 2,
    ]);

    setBoundariesTruncated(plan?.zoomHint ?? false);

    if (!plan) return;

    for (const tile of plan.tiles) {
      const key = boundaryTileKey(tile);

      if (cache.has(key) || pending.has(key)) continue;

      pending.add(key);
      setBoundariesLoading(true);
      load(tile.x, tile.y, tile.z)
        .then((data) => {
          cache.set(key, data);

          // obciety kafel z14 pamietamy do konca sesji: drugi raz o niego nie pytamy, od razu kafle z16
          if (data.truncated && tile.z === BOUNDARIES_MIN_ZOOM) truncatedCoarseTiles.add(key);

          for (const old of cache.keys()) {
            if (cache.size <= BOUNDARY_TILE_CACHE) break;

            if (!plan.visible.has(old)) cache.delete(old);
          }

          const current = mapRef.current;
          const { lines, labels: points } = outlineCollections(cache.values());

          void current?.getSource<MapLibre.GeoJSONSource>(BOUNDARIES_SOURCE)?.setData(lines);
          void current?.getSource<MapLibre.GeoJSONSource>(BOUNDARY_LABELS_SOURCE)?.setData(points);

          // obciety kafel zmienia plan widoku (kafle z16 albo podpowiedz) - liczymy go od nowa dla obecnej mapy
          if (data.truncated) refresh();

          return data.items.length;
        })
        // brak granic nie blokuje pracy z mapa; kafel sprobuje sie pobrac przy nastepnym ruchu
        .catch(() => 0)
        .finally(() => {
          pending.delete(key);

          if (pending.size === 0) setBoundariesLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const boundaryCache = boundaryTilesRef.current;
    const reported = reportedRef.current;
    let cancelled = false;
    let map: MapLibre.Map | null = null;

    async function create(target: HTMLElement): Promise<void> {
      const maplibre = await loadMapLibre();

      if (cancelled) return;

      const text = latest.current.labels;
      const padding = latest.current.getPadding();
      // Start od razu na miejscu: dzialka znana juz teraz (dojazd "twardy") albo ostatni kadr z poprzedniej mapy;
      // widok calej Polski tylko przy pierwszej mapie w karcie, gdy nie wiadomo jeszcze, co pokazac.
      const initialFocus = latest.current.focus;
      const remembered = startFromCountryRef.current ? null : readCamera();
      const startAtFocus = initialFocus !== null && (!initialFocus.soft || remembered === null);
      const created = new maplibre.Map({
        container: target,
        style: BASEMAP_STYLE_URL,
        bounds: startAtFocus ? initialFocus.bbox : INITIAL_BOUNDS,
        // maxZoom tylko przy dzialce: `undefined` nadpisaloby domyslne przyblizenie MapLibre
        fitBoundsOptions: startAtFocus ? { padding, maxZoom: FOCUS_MAX_ZOOM } : { padding },
        maxBounds: MAX_BOUNDS,
        interactive,
        // Obrot i pochylenie myla przy szukaniu pola: polnoc zawsze u gory.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        locale: {
          'NavigationControl.ZoomIn': text.zoomIn,
          'NavigationControl.ZoomOut': text.zoomOut,
          'GeolocateControl.FindMyLocation': text.locate,
          'GeolocateControl.LocationNotAvailable': text.locateUnavailable,
          'AttributionControl.ToggleAttribution': text.attribution,
        },
      });

      map = created;
      firstFocusRef.current = true;
      countryViewRef.current = !startAtFocus && (remembered === null || remembered.zoom < FAR_ZOOM);
      setCountryStart(countryViewRef.current && !startFromCountryRef.current);

      if (!startAtFocus && remembered) {
        jumpToVisibleCenter(created, padding, remembered.center, remembered.zoom);

        // miekki dojazd (moje dzialki) tylko wtedy, gdy z poprzedniego kadru dzialek nie widac
        if (initialFocus && (remembered.zoom < FAR_ZOOM || !showsArea(created, padding, initialFocus.bbox))) {
          created.fitBounds(initialFocus.bbox, { padding, maxZoom: FOCUS_MAX_ZOOM, duration: 0 });
        }
      }

      if (initialFocus) {
        focusedKeyRef.current = initialFocus.key;
        firstFocusRef.current = false;
      }

      created.touchZoomRotate.disableRotation();
      // uzytkownik ruszyl mape sam - kolejny dojazd juz z animacja (widac, skad i dokad jedzie mapa)
      created.on('movestart', (event) => {
        if (!event.originalEvent) return;

        firstFocusRef.current = false;
        countryViewRef.current = false;
      });
      created.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');

      const controls = interactive
        ? createMapControls(maplibre, created, (locate) => latest.current.onLocateState?.(locate))
        : null;

      if (interactive) {
        created.on('click', (event) => {
          if (created.getZoom() < MIN_PICK_ZOOM) {
            created.easeTo({ center: event.lngLat, zoom: MIN_PICK_ZOOM + 1 });
            latest.current.onZoomTooLow?.();

            return;
          }

          // w trybie rysowania stukniecie to tylko punkt obrysu - dzialka pod nim nie ma znaczenia
          if (latest.current.drawing) {
            latest.current.onPick?.(event.lngLat.lng, event.lngLat.lat);

            return;
          }

          // Dzialka z warstwy granic jest znana od razu - zaznaczenie nie czeka na odpowiedz API.
          const [hit] = created.getLayer(BOUNDARY_HIT_LAYER)
            ? created.queryRenderedFeatures(event.point, { layers: [BOUNDARY_HIT_LAYER] })
            : [];
          const hitId: unknown = hit?.properties.id;
          const outline =
            typeof hitId === 'string'
              ? [...boundaryCache.values()]
                  .flatMap((tile) => tile.items)
                  .find((candidate) => candidate.id === hitId)
              : undefined;

          latest.current.onPick?.(event.lngLat.lng, event.lngLat.lat, outline);
        });

        // Pod kursorem myszy dzialka lekko sie podswietla - widac, co zostanie wskazane. W trybie rysowania nie:
        // stukniecie dodaje punkt, a podswietlona dzialka wygladalaby na wybrana (na dotyku zostaje po stuknieciu).
        let hovered: string | null = null;
        const setHover = (id: string | null) => {
          if (hovered === id) return;

          if (hovered !== null) {
            created.setFeatureState({ source: BOUNDARIES_SOURCE, id: hovered }, { hover: false });
          }

          if (id !== null) created.setFeatureState({ source: BOUNDARIES_SOURCE, id }, { hover: true });

          hovered = id;
          // atrybut diagnostyczny dla testow e2e: ktora dzialka jest podswietlona
          target.dataset.mapHover = id ?? '';

          if (!latest.current.drawing) created.getCanvas().style.cursor = id === null ? '' : 'pointer';
        };

        clearHoverRef.current = () => setHover(null);
        created.on('mousemove', BOUNDARY_HIT_LAYER, (event) => {
          const id: unknown = event.features?.[0]?.properties.id;

          setHover(typeof id === 'string' && !latest.current.drawing ? id : null);
        });
        created.on('mouseleave', BOUNDARY_HIT_LAYER, () => setHover(null));
      }

      created.on('load', () => {
        if (cancelled) return;

        addAppLayers(created, target);
        // waska mapa (telefon): MapLibre rozwija zrodla danych na starcie i zwija dopiero po przeciagnieciu - zwijamy
        // od razu do przycisku "i", zeby tekst nie wchodzil pod pigulke legendy w lewym dolnym rogu
        target.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        created.on('moveend', refreshBoundaries);
        created.on('moveend', refreshHydro);
        created.on('moveend', refreshContext);
        // Kadr w DOM (bez renderu Reacta): testy e2e czekaja na koniec animacji i porownuja kadry miedzy stronami.
        // Mapa interaktywna zapamietuje kadr dla nastepnej mapy (podglad w kroku dzialki tylko z niego korzysta).
        const markView = () => {
          const center = visibleCenter(created, latest.current.getPadding());

          target.dataset.mapZoom = created.getZoom().toFixed(2);
          target.dataset.mapCenter = center.map((value) => value.toFixed(6)).join(',');

          if (interactive) saveCamera({ center, zoom: created.getZoom() });
        };

        markView();
        created.on('moveend', markView);
        mapRef.current = created;
        setState('ready');
        latest.current.onControls?.(controls);
      });
    }

    if (container) {
      create(container).catch(() => {
        if (!cancelled) setState('failed');
      });
    }

    return () => {
      cancelled = true;
      mapRef.current = null;
      clearHoverRef.current = noop;
      latest.current.onControls?.(null);
      focusedKeyRef.current = null;
      imageryCountRef.current = 0;
      boundaryCache.clear();
      tileLayers().hydro.clear();

      for (const tileLayer of tileLayers().context.values()) tileLayer.clear();

      reported.clear();
      map?.remove();
    };
  }, [interactive, refreshBoundaries, refreshHydro, refreshContext, tileLayers]);

  useEffect(() => {
    if (state !== 'ready') return;

    const source = mapRef.current?.getSource<MapLibre.GeoJSONSource>(SELECTED_SOURCE);

    void source?.setData(parcelCollection(selected));
  }, [state, selected]);

  useEffect(() => {
    if (state !== 'ready') return;

    const source = mapRef.current?.getSource<MapLibre.GeoJSONSource>(PREVIEW_SOURCE);

    void source?.setData(parcelCollection(preview ? [preview] : []));
  }, [state, preview]);

  useEffect(() => {
    if (state !== 'ready') return;
    const map = mapRef.current;

    void map
      ?.getSource<MapLibre.GeoJSONSource>(DRAW_SOURCE)
      ?.setData(drawingCollection(drawing ?? { areas: [], line: null, points: [] }));

    // w trybie rysowania kursor celownika - stukniecie dodaje punkt, nie wybiera dzialki
    if (drawing) clearHoverRef.current();

    if (map) map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
  }, [state, drawing]);

  // Obraz z satelity: zrodla `image` (PNG z naroznikami) nad podkladem i zdjeciem lotniczym, pod rowami i granicami.
  // Podklad przelacza tylko widocznosc warstwy zdjecia, wiec obraz przetrwa zmiane podkladu.
  useEffect(() => {
    const map = mapRef.current;

    if (state !== 'ready' || !map) return;

    for (let index = 0; index < imageryCountRef.current; index += 1) {
      const id = `${IMAGERY_PREFIX}${index}`;

      if (map.getLayer(id)) map.removeLayer(id);

      if (map.getSource(id)) map.removeSource(id);
    }

    imagery.forEach((overlay, index) => {
      const id = `${IMAGERY_PREFIX}${index}`;

      map.addSource(id, { type: 'image', url: overlay.image, coordinates: imageCorners(overlay.bbox) });
      map.addLayer({ id, type: 'raster', source: id, paint: IMAGERY_PAINT }, HYDRO_LAYER_IDS[0]);
    });
    imageryCountRef.current = imagery.length;
    // zielone wypelnienie zaznaczenia zafalszowaloby kolory obrazu - zostaje sam obrys
    map.setPaintProperty(`${SELECTED_SOURCE}-fill`, 'fill-opacity', imagery.length > 0 ? 0 : 0.22);
  }, [state, imagery]);

  useEffect(() => {
    if (state !== 'ready') return;

    mapRef.current?.setLayoutProperty(ORTHO_LAYER.id, 'visibility', basemap === 'ortho' ? 'visible' : 'none');
  }, [state, basemap]);

  useEffect(() => {
    if (state !== 'ready') return;

    for (const id of BOUNDARY_LAYER_IDS) {
      mapRef.current?.setLayoutProperty(id, 'visibility', boundaries ? 'visible' : 'none');
    }

    refreshBoundaries();
  }, [state, boundaries, refreshBoundaries]);

  useEffect(() => {
    if (state !== 'ready' || !mapRef.current) return;

    setHydroVisible(mapRef.current, hydro);
    refreshHydro();
  }, [state, hydro, refreshHydro]);

  const { cover, waterworks, protected: protectedAreas } = context;

  useEffect(() => {
    const map = mapRef.current;

    if (state !== 'ready' || !map) return;

    setContextVisible(map, 'cover', cover);
    setContextVisible(map, 'waterworks', waterworks);
    setContextVisible(map, 'protected', protectedAreas);
    refreshContext();
  }, [state, cover, waterworks, protectedAreas, refreshContext]);

  const hydroLoading = hydro && tilesLoading.has('hydro');
  const contextLoading = CONTEXT_LAYERS.some(
    (layer) => context[layer] && tilesLoading.has(`context-${layer}`),
  );
  const loadingAny = status !== null || boundariesLoading || hydroLoading || contextLoading;
  const message =
    status ??
    (boundariesLoading
      ? labels.loadingBoundaries
      : hydroLoading
        ? labels.loadingHydro
        : contextLoading
          ? labels.loadingContext
          : boundaries && boundariesTruncated
            ? labels.zoomForBoundaries
            : null);
  const focusKey = focus?.key ?? null;
  const focusSoft = focus?.soft ?? false;
  const [west, south, east, north] = focus?.bbox ?? [0, 0, 0, 0];

  useEffect(() => {
    const map = mapRef.current;

    if (state !== 'ready' || !map || focusKey === null || focusedKeyRef.current === focusKey) return;

    const padding = latest.current.getPadding();
    const first = firstFocusRef.current;

    const countryView = countryViewRef.current;

    focusedKeyRef.current = focusKey;
    firstFocusRef.current = false;
    countryViewRef.current = false;

    // miekki dojazd nie rusza mapy, jesli obszar juz widac - kadr wybrany przez uzytkownika zostaje. Widok calej
    // Polski to nie wybor: dzialka doczytana po utworzeniu mapy (wejscie z linku, wolna siec) "widac" w nim zawsze,
    // wiec bez tego warunku mapa zostawalaby na calym kraju.
    if (
      focusSoft &&
      !countryView &&
      map.getZoom() >= FAR_ZOOM &&
      showsArea(map, padding, [west, south, east, north])
    ) {
      return;
    }

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding, maxZoom: FOCUS_MAX_ZOOM, duration: first ? 0 : 900 },
    );
  }, [state, focusKey, focusSoft, west, south, east, north]);

  return (
    <div className={cn('relative size-full overflow-hidden bg-muted', className)}>
      <div
        ref={containerRef}
        role="application"
        aria-label={labels.map}
        data-testid="parcel-map"
        data-map-state={state}
        // wymiary z rodzica, nie `absolute`: arkusz stylow MapLibre ustawia kontenerowi `position: relative`
        className="size-full"
      />
      {state === 'ready' && message !== null && (
        <output
          className={cn(
            'pointer-events-none absolute bottom-3 left-1/2 z-10 flex w-max max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-sm font-medium text-card-foreground shadow-md',
            statusClassName,
          )}
          data-testid="map-status"
        >
          {loadingAny && <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />}
          {message}
        </output>
      )}
      {state === 'loading' && placeholder}
      {state === 'ready' && awaitFocus && countryStart && (
        // zaslona do pierwszego dojazdu: zamiast mapy kraju - obrys dzialki (jesli znany) i napis
        <div className="absolute inset-0 z-10 bg-muted" data-testid="map-veil">
          {placeholder}
          <output className="absolute bottom-3 left-1/2 z-10 w-max max-w-[calc(100%-6rem)] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1.5 text-sm text-muted-foreground shadow-md">
            {labels.loading}
          </output>
        </div>
      )}
      {state !== 'ready' && (
        <output
          className={cn(
            'absolute flex items-center justify-center text-center text-sm text-muted-foreground',
            state === 'loading' && placeholder
              ? 'bottom-3 left-1/2 z-10 w-max max-w-[calc(100%-6rem)] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1.5 shadow-md'
              : 'inset-0 px-6',
          )}
        >
          {state === 'loading' ? labels.loading : labels.failed}
        </output>
      )}
    </div>
  );
}
