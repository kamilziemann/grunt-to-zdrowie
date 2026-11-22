// Mapa dzialek na MapLibre GL. Biblioteka i WebGL istnieja tylko w przegladarce, wiec modul mapy laduje sie leniwie
// w efekcie (osobny chunk, nic w SSR). Jeden styl na cale zycie mapy: ortofotomapa to warstwa rastrowa z
// przelaczana widocznoscia, a nie `setStyle` - dzieki temu zaznaczone dzialki nie znikaja przy zmianie podkladu.
import 'maplibre-gl/dist/maplibre-gl.css';

import type { HydroTile, ParcelBoundaries, ParcelBoundaryTileZoom, ParcelOutline } from '@app/contracts';
import { LoaderCircle } from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';

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
import { cn } from '@/lib/utils/cn';

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
  boundaryTiles,
  boundaryTileZoom,
  coarseParent,
  DRAW_SOURCE,
  drawingCollection,
  IMAGERY_PAINT,
  IMAGERY_PREFIX,
  imageCorners,
  INITIAL_BOUNDS,
  isPoiLayer,
  LOCAL_NAME,
  MAX_BOUNDARY_TILES,
  MAX_BOUNDS,
  MIN_PICK_ZOOM,
  outlineCollections,
  type MapParcel,
  parcelCollection,
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
  /** podpowiedz, gdy kafel granic byl obciety przez usluge (miasto, gesta szachownica) */
  zoomForBoundaries: string;
}

/**
 * Stan warstwy "Rowy i cieki" dla legendy: `zoom` = za male przyblizenie (nic nie pobieramy), `unavailable` = API
 * odpowiada 404/503 (trasa jeszcze nie wdrozona albo baza nie odpowiada).
 */
export interface HydroStatus {
  state: 'off' | 'zoom' | 'loading' | 'ready' | 'unavailable';
  /** data importu BDOT10k z pobranych kafli */
  importedAt: string | null;
  /** ktorys kafel byl przyciety do limitu obiektow */
  truncated: boolean;
}

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
  labels: ParcelMapLabels;
  className?: string;
}

type MapState = 'loading' | 'ready' | 'failed';

const DEFAULT_PADDING: MapPadding = { top: 48, right: 48, bottom: 48, left: 48 };
const defaultPadding = () => DEFAULT_PADDING;
const NO_IMAGERY: readonly ImageryOverlay[] = [];

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
  imagery = NO_IMAGERY,
  focus = null,
  getPadding = defaultPadding,
  interactive = true,
  onPick,
  onZoomTooLow,
  status = null,
  statusClassName,
  labels,
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
  const [hydroLoading, setHydroLoading] = useState(false);
  // Najnowsze wartosci dla zdarzen mapy, ktora powstaje raz - bez przepinania sluchaczy przy kazdym renderze.
  const latest = useRef({
    onPick,
    onZoomTooLow,
    getPadding,
    labels,
    boundaries,
    loadBoundaries,
    hydro,
    loadHydro,
    onHydroStatus,
  });
  // Obrysy pobrane kaflami siatki granic: klucz "z/x/y" -> kafel; kolejnosc wpisow = kolejnosc pobrania.
  const boundaryTilesRef = useRef(new Map<string, ParcelBoundaries>());
  const pendingTilesRef = useRef(new Set<string>());
  // Kafle hydrografii: klucz "x/y" -> kafel; `unavailable` = ostatnia odpowiedz 404/503 (ponowimy przy ruchu mapy).
  const hydroRef = useRef({
    tiles: new Map<string, HydroTile>(),
    pending: new Set<string>(),
    unavailable: false,
    reported: '',
  });

  useEffect(() => {
    latest.current = {
      onPick,
      onZoomTooLow,
      getPadding,
      labels,
      boundaries,
      loadBoundaries,
      hydro,
      loadHydro,
      onHydroStatus,
    };
  });

  /** Zglasza stan warstwy hydrografii, tylko gdy sie zmienil. */
  const reportHydro = useCallback((layerState: HydroStatus['state']) => {
    const cache = hydroRef.current;
    const tiles = [...cache.tiles.values()];
    const next: HydroStatus = {
      state: layerState,
      importedAt: latestImport(tiles),
      truncated: tiles.some((tile) => tile.truncated),
    };
    const key = JSON.stringify(next);

    if (key === cache.reported) return;

    cache.reported = key;
    latest.current.onHydroStatus?.(next);
  }, []);

  /** Dociaga rowy i cieki dla widoku: tylko przy wlaczonej warstwie i od przyblizenia, przy ktorym widac pola. */
  const refreshHydro = useCallback(() => {
    const map = mapRef.current;
    const { hydro: enabled, loadHydro: load } = latest.current;
    const cache = hydroRef.current;

    if (!map || !enabled || !load) {
      reportHydro('off');

      return;
    }

    const view = map.getBounds();
    const tiles = hydroTiles(view.getWest(), view.getSouth(), view.getEast(), view.getNorth());

    if (map.getZoom() < HYDRO_MIN_ZOOM || tiles.length > MAX_HYDRO_TILES) {
      reportHydro('zoom');

      return;
    }

    const visible = new Set(tiles.map((tile) => `${tile.x}/${tile.y}`));
    const missing = tiles.filter((tile) => {
      const key = `${tile.x}/${tile.y}`;

      return !cache.tiles.has(key) && !cache.pending.has(key);
    });

    if (missing.length === 0) {
      reportHydro(cache.pending.size > 0 ? 'loading' : cache.unavailable ? 'unavailable' : 'ready');

      return;
    }

    cache.unavailable = false;
    reportHydro('loading');
    setHydroLoading(true);

    for (const tile of missing) {
      const key = `${tile.x}/${tile.y}`;

      cache.pending.add(key);
      load(tile.x, tile.y)
        .then((data) => {
          cache.tiles.set(key, data);

          for (const old of cache.tiles.keys()) {
            if (cache.tiles.size <= HYDRO_TILE_CACHE) break;

            if (!visible.has(old)) cache.tiles.delete(old);
          }

          const current = mapRef.current;

          if (current)
            setHydroData(current, hydroCollections([...cache.tiles.values()].map((t) => t.features)));

          return data.features.length;
        })
        // brak warstwy nie blokuje pracy z mapa; kafel sprobuje sie pobrac przy nastepnym ruchu
        .catch((error: unknown) => {
          if (error instanceof HydroUnavailableError) cache.unavailable = true;

          return 0;
        })
        .finally(() => {
          cache.pending.delete(key);

          if (cache.pending.size > 0) return;

          setHydroLoading(false);
          reportHydro(cache.unavailable ? 'unavailable' : 'ready');
        });
    }
  }, [reportHydro]);

  /**
   * Dociaga granice dla widoku - tylko gdy warstwa jest wlaczona i od przyblizenia 14. Ponizej 16 grube kafle z14;
   * od 16 drobne kafle z16, ale tylko tam, gdzie pelnego kafla z14 nie ma w pamieci (obciety albo niepobrany).
   */
  const refreshBoundaries = useCallback(() => {
    const map = mapRef.current;
    const { boundaries: enabled, loadBoundaries: load } = latest.current;
    const cache = boundaryTilesRef.current;
    const pending = pendingTilesRef.current;

    if (!map || !enabled || !load || map.getZoom() < BOUNDARIES_MIN_ZOOM) {
      setBoundariesTruncated(false);

      return;
    }

    const zoom = boundaryTileZoom(map.getZoom());
    const view = map.getBounds();
    const inView = boundaryTiles(view.getWest(), view.getSouth(), view.getEast(), view.getNorth(), zoom);

    if (inView.length > MAX_BOUNDARY_TILES[zoom]) {
      setBoundariesTruncated(false);

      return;
    }

    const tiles = inView.filter((tile) => {
      if (tile.z === BOUNDARIES_MIN_ZOOM) return true;

      const parent = cache.get(boundaryTileKey(coarseParent(tile)));

      return !parent || parent.truncated;
    });
    const visible = new Set(
      inView.flatMap((tile) => [boundaryTileKey(tile), boundaryTileKey(coarseParent(tile))]),
    );
    const truncatedInView = () =>
      zoom === BOUNDARIES_MIN_ZOOM && tiles.some((tile) => cache.get(boundaryTileKey(tile))?.truncated);

    setBoundariesTruncated(truncatedInView());

    for (const tile of tiles) {
      const key = boundaryTileKey(tile);

      if (cache.has(key) || pending.has(key)) continue;

      pending.add(key);
      setBoundariesLoading(true);
      load(tile.x, tile.y, tile.z)
        .then((data) => {
          cache.set(key, data);

          for (const old of cache.keys()) {
            if (cache.size <= BOUNDARY_TILE_CACHE) break;

            if (!visible.has(old)) cache.delete(old);
          }

          const current = mapRef.current;
          const { lines, labels: points } = outlineCollections(cache.values());

          void current?.getSource<MapLibre.GeoJSONSource>(BOUNDARIES_SOURCE)?.setData(lines);
          void current?.getSource<MapLibre.GeoJSONSource>(BOUNDARY_LABELS_SOURCE)?.setData(points);

          // podpowiedz tylko, jesli mapa stoi tam, gdzie byla (przy ruchu przeliczy ja nastepne odswiezenie)
          if (current && boundaryTileZoom(current.getZoom()) === zoom)
            setBoundariesTruncated(truncatedInView());

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
    const hydroCache = hydroRef.current;
    let cancelled = false;
    let map: MapLibre.Map | null = null;

    async function create(target: HTMLElement): Promise<void> {
      const maplibre = await loadMapLibre();

      if (cancelled) return;

      const text = latest.current.labels;
      const created = new maplibre.Map({
        container: target,
        style: BASEMAP_STYLE_URL,
        bounds: INITIAL_BOUNDS,
        fitBoundsOptions: { padding: latest.current.getPadding() },
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
      created.touchZoomRotate.disableRotation();
      created.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');

      if (interactive) {
        created.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        created.addControl(
          new maplibre.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
          'top-right',
        );
        created.on('click', (event) => {
          if (created.getZoom() < MIN_PICK_ZOOM) {
            created.easeTo({ center: event.lngLat, zoom: MIN_PICK_ZOOM + 1 });
            latest.current.onZoomTooLow?.();

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

        // Pod kursorem myszy dzialka lekko sie podswietla - widac, co zostanie wskazane.
        let hovered: string | null = null;
        const setHover = (id: string | null) => {
          if (hovered === id) return;

          if (hovered !== null) {
            created.setFeatureState({ source: BOUNDARIES_SOURCE, id: hovered }, { hover: false });
          }

          if (id !== null) created.setFeatureState({ source: BOUNDARIES_SOURCE, id }, { hover: true });

          hovered = id;
          created.getCanvas().style.cursor = id === null ? '' : 'pointer';
        };

        created.on('mousemove', BOUNDARY_HIT_LAYER, (event) => {
          const id: unknown = event.features?.[0]?.properties.id;

          setHover(typeof id === 'string' ? id : null);
        });
        created.on('mouseleave', BOUNDARY_HIT_LAYER, () => setHover(null));
      }

      created.on('load', () => {
        if (cancelled) return;

        addAppLayers(created, target);
        created.on('moveend', refreshBoundaries);
        created.on('moveend', refreshHydro);
        mapRef.current = created;
        setState('ready');
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
      focusedKeyRef.current = null;
      imageryCountRef.current = 0;
      boundaryCache.clear();
      hydroCache.tiles.clear();
      hydroCache.reported = '';
      map?.remove();
    };
  }, [interactive, refreshBoundaries, refreshHydro]);

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

  const loadingAny = status !== null || boundariesLoading || (hydro && hydroLoading);
  const message =
    status ??
    (boundariesLoading
      ? labels.loadingBoundaries
      : hydro && hydroLoading
        ? labels.loadingHydro
        : boundaries && boundariesTruncated
          ? labels.zoomForBoundaries
          : null);
  const focusKey = focus?.key ?? null;
  const [west, south, east, north] = focus?.bbox ?? [0, 0, 0, 0];

  useEffect(() => {
    if (state !== 'ready' || focusKey === null || focusedKeyRef.current === focusKey) return;

    focusedKeyRef.current = focusKey;
    mapRef.current?.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: latest.current.getPadding(), maxZoom: 17, duration: 900 },
    );
  }, [state, focusKey, west, south, east, north]);

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
      {state !== 'ready' && (
        <output className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {state === 'loading' ? labels.loading : labels.failed}
        </output>
      )}
    </div>
  );
}
