// Plotno mapy w raporcie (MapLibre) - modul ladowany leniwie przez `FieldMap`, wiec MapLibre i jego arkusz stylow
// nie wchodza do JS strony raportu. Zdjecie lotnicze, rowy i cieki w promieniu 500 m, wyrozniony najblizszy row i
// ciek, obrys pola. Po kazdym dorysowaniu mapa zapisuje obraz (PNG) - wydruk pokazuje obraz zamiast plotna WebGL.
import 'maplibre-gl/dist/maplibre-gl.css';

import type { HydroFeature, ParcelGeometry } from '@app/contracts';
import type { FeatureCollection } from 'geojson';
import type * as MapLibre from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { addHydroLayers, hydroCollections, hydroColors, setHydroData } from '@/lib/hydro-map';
import { GLYPHS_URL, loadMapLibre, ORTHO_LAYER, ORTHO_SOURCE } from '@/lib/map-base';

export interface FieldMapCanvasProps {
  field: ParcelGeometry;
  /** [zachod, poludnie, wschod, polnoc] widoku */
  bbox: [number, number, number, number];
  features: readonly HydroFeature[];
  /** najblizszy row i ciek - wyroznione kolorem */
  nearest: readonly HydroFeature[];
  /** obraz mapy do wydruku (data: URL) albo null, gdy plotna nie da sie zapisac */
  onSnapshot: (dataUrl: string | null) => void;
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
  onSnapshot,
  onFailed,
}: FieldMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onSnapshot, onFailed });
  const [west, south, east, north] = bbox;

  useEffect(() => {
    latest.current = { onSnapshot, onFailed };
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
        interactive: false,
        attributionControl: false,
        // obraz do wydruku: bez tego bufor plotna jest czyszczony po kazdej klatce
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });

      map = created;
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
        mapRef.current = created;
        setReady(true);
      });
      created.on('idle', () => {
        try {
          latest.current.onSnapshot(created.getCanvas().toDataURL('image/png'));
        } catch {
          // plotno "skazone" obcym kafelkiem - wydruk pokaze plotno
          latest.current.onSnapshot(null);
        }
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
  }, [ready, features, nearest]);

  // tresc mapy opisuje podpis pod nia (`FieldMap`), plotno jest dla czytnika ekranu tylko ozdoba
  return <div ref={containerRef} aria-hidden="true" className="size-full" data-testid="field-map-canvas" />;
}
