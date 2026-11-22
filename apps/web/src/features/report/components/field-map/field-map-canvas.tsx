// Plotno mapy w raporcie (MapLibre) - modul ladowany leniwie przez `FieldMap` po wyborze "Zdjecie lotnicze", wiec
// MapLibre i jego arkusz stylow nie wchodza do JS strony raportu. Zdjecie lotnicze, rowy i cieki w promieniu 500 m,
// wyrozniony najblizszy row i ciek, obrys pola i miejsca na polu (te same wzory i numery co na szkicu, klikalne).
// Warstwy wlacza i wylacza przelacznik obok mapy. Na wydruk idzie szkic (SVG), nie to plotno.
import 'maplibre-gl/dist/maplibre-gl.css';

import type { HydroFeature, ParcelGeometry, Zone } from '@app/contracts';
import type { FeatureCollection } from 'geojson';
import type * as MapLibre from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import {
  addHydroLayers,
  hydroCollections,
  hydroColors,
  setHydroData,
  setHydroVisible,
} from '@/lib/hydro-map';
import { GLYPHS_URL, loadMapLibre, ORTHO_LAYER, ORTHO_SOURCE } from '@/lib/map-base';

import {
  addZoneLayers,
  setZoneActive,
  setZoneData,
  setZonesVisible,
  ZONE_HIT_LAYERS,
  zoneColors,
  type ZoneColors,
  type ZoneMark,
} from './zone-layers';

/** Warstwy mapy wlaczone przelacznikiem. */
export interface FieldMapLayers {
  photo: boolean;
  water: boolean;
  zones: boolean;
}

export interface FieldMapCanvasProps {
  field: ParcelGeometry;
  /** [zachod, poludnie, wschod, polnoc] widoku */
  bbox: [number, number, number, number];
  features: readonly HydroFeature[];
  /** najblizszy row i ciek - wyroznione kolorem */
  nearest: readonly HydroFeature[];
  /** rodzaj i numer miejsc na polu (jak na szkicu) i ich geometria */
  zones: readonly ZoneMark[];
  zoneShapes: readonly Pick<Zone, 'id' | 'geometry'>[];
  /** wyroznione miejsce (wspolny stan ze szkicem i zaleceniami) */
  activeZone: string | null;
  layers: FieldMapLayers;
  /** przyblizenie ponad kadr pola (0 = cale pole); po przyblizeniu mape da sie przesuwac */
  zoomStep: number;
  /** klikniecie miejsca - zaznacza je albo (drugie klikniecie) odznacza */
  onZoneToggle: (zoneId: string) => void;
  /** klikniecie obok miejsc - zdejmuje wyroznienie */
  onZoneClear: () => void;
  /** mapa nie wstala (brak WebGL) - zostaje sam podpis */
  onFailed: () => void;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function collection(geometries: readonly HydroFeature['geometry'][]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geometries.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
  };
}

export function FieldMapCanvas({
  field,
  bbox,
  features,
  nearest,
  zones,
  zoneShapes,
  activeZone,
  layers,
  zoomStep,
  onZoneToggle,
  onZoneClear,
  onFailed,
}: FieldMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const colorsRef = useRef<ZoneColors | null>(null);
  const baseZoom = useRef(0);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onFailed, onZoneToggle, onZoneClear });
  const [west, south, east, north] = bbox;

  useEffect(() => {
    latest.current = { onFailed, onZoneToggle, onZoneClear };
  });

  useEffect(() => {
    const container = containerRef.current;
    let cancelled = false;
    let map: MapLibre.Map | null = null;

    async function create(target: HTMLElement): Promise<void> {
      const maplibre = await loadMapLibre();

      if (cancelled) return;

      const created = new maplibre.Map({
        container: target,
        style: {
          version: 8,
          glyphs: GLYPHS_URL,
          sources: { [ORTHO_SOURCE.id]: ORTHO_SOURCE.spec },
          layers: [ORTHO_LAYER],
        },
        bounds: [
          [west, south],
          [east, north],
        ],
        fitBoundsOptions: { padding: 24 },
        // tylko klikniecie w miejsce: bez przesuwania i przyblizania (na telefonie mapa nie lapie przewijania strony)
        dragPan: false,
        dragRotate: false,
        scrollZoom: false,
        boxZoom: false,
        doubleClickZoom: false,
        keyboard: false,
        touchZoomRotate: false,
        touchPitch: false,
        attributionControl: false,
      });

      map = created;
      // klawiatura wybiera miejsca na szkicu i w listach - plotno (ozdoba dla czytnika) nie bierze fokusu
      created.getCanvas().tabIndex = -1;
      created.on('load', () => {
        if (cancelled) return;

        const style = getComputedStyle(target);
        const token = (name: string) => style.getPropertyValue(name).trim();
        const casing = token('--map-casing');
        const highlight = token('--map-highlight');
        const selected = token('--map-selected');

        addHydroLayers(created, hydroColors(target));
        created.addSource('hydro-nearest', { type: 'geojson', data: EMPTY });
        created.addLayer({
          id: 'hydro-nearest-line',
          type: 'line',
          source: 'hydro-nearest',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': highlight, 'line-width': 4.5 },
        });
        created.addSource('field', { type: 'geojson', data: collection([field]) });
        created.addLayer({
          id: 'field-fill',
          type: 'fill',
          source: 'field',
          paint: { 'fill-color': selected, 'fill-opacity': 0.18 },
        });
        created.addLayer({
          id: 'field-casing',
          type: 'line',
          source: 'field',
          paint: { 'line-color': casing, 'line-width': 5, 'line-opacity': 0.9 },
        });
        created.addLayer({
          id: 'field-line',
          type: 'line',
          source: 'field',
          paint: { 'line-color': selected, 'line-width': 2.5 },
        });
        // miejsca na polu: wzor i numer jak na szkicu; klikniecie miejsca zaznacza je, klikniecie obok odznacza
        const colors = zoneColors(target);

        colorsRef.current = colors;
        addZoneLayers(created, colors);
        created.on('click', (event) => {
          const hit = created.queryRenderedFeatures(event.point, { layers: [...ZONE_HIT_LAYERS] })[0];
          const id: unknown = hit?.properties.id;

          if (typeof id === 'string') latest.current.onZoneToggle(id);
          else latest.current.onZoneClear();
        });
        created.on('mousemove', (event) => {
          const over =
            created.queryRenderedFeatures(event.point, { layers: [...ZONE_HIT_LAYERS] }).length > 0;

          created.getCanvas().style.cursor = over ? 'pointer' : '';
        });
        baseZoom.current = created.getZoom();
        mapRef.current = created;
        setReady(true);
      });
    }

    if (container) {
      create(container).catch(() => {
        if (!cancelled) latest.current.onFailed();
      });
    }

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, [field, west, south, east, north]);

  useEffect(() => {
    const map = mapRef.current;

    if (!ready || !map) return;

    setHydroData(map, hydroCollections([features]));
    void map
      .getSource<MapLibre.GeoJSONSource>('hydro-nearest')
      ?.setData(collection(nearest.map((feature) => feature.geometry)));
    setZoneData(map, zones, zoneShapes);
  }, [ready, features, nearest, zones, zoneShapes]);

  useEffect(() => {
    const map = mapRef.current;
    const colors = colorsRef.current;

    if (!ready || !map || !colors) return;
    setZoneActive(map, activeZone, colors);
  }, [ready, activeZone]);

  // przyciski "Przybliz / Oddal" sa poza plotnem (HTML), tu tylko ruch mapy; cale pole = wroc do kadru
  useEffect(() => {
    const map = mapRef.current;

    if (!ready || !map) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (zoomStep === 0) {
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 24, animate: smooth },
      );
      map.dragPan.disable();
    } else {
      map.easeTo({ zoom: baseZoom.current + zoomStep, animate: smooth });
      map.dragPan.enable();
    }
  }, [ready, zoomStep, west, south, east, north]);

  useEffect(() => {
    const map = mapRef.current;

    if (!ready || !map) return;
    map.setLayoutProperty(ORTHO_LAYER.id, 'visibility', layers.photo ? 'visible' : 'none');
    setHydroVisible(map, layers.water);
    map.setLayoutProperty('hydro-nearest-line', 'visibility', layers.water ? 'visible' : 'none');
    setZonesVisible(map, layers.zones);
  }, [ready, layers.photo, layers.water, layers.zones]);

  // tresc mapy opisuje podpis i lista miejsc (`FieldMap`), plotno jest dla czytnika ekranu tylko ozdoba; miejsca
  // da sie wybrac takze z listy pod mapa i z zalecen
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="size-full bg-muted"
      data-testid="field-map-canvas"
      data-ready={ready ? 'true' : 'false'}
      data-active-zone={activeZone ?? ''}
    />
  );
}
