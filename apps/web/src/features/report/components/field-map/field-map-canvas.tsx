// Plotno mapy w raporcie (MapLibre) - modul ladowany leniwie przez `FieldMap` po kliknieciu "Pokaz na zdjeciu
// lotniczym", wiec MapLibre i jego arkusz stylow nie wchodza do JS strony raportu. Zdjecie lotnicze, rowy i cieki
// w promieniu 500 m, wyrozniony najblizszy row i ciek, obrys pola i miejsca na polu (obrys z numerem jak na szkicu).
// Na wydruk idzie szkic (SVG), nie to plotno.
import 'maplibre-gl/dist/maplibre-gl.css';

import type { HydroFeature, ParcelGeometry, Zone } from '@app/contracts';
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
  /** numery miejsc na polu (jak na szkicu) i ich geometria */
  zones: readonly { id: string; number: number }[];
  zoneShapes: readonly Pick<Zone, 'id' | 'geometry'>[];
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

/** Miejsca na polu jako obiekty GeoJSON z numerem (do podpisu na mapie). */
function zoneCollection(
  zones: FieldMapCanvasProps['zones'],
  shapes: FieldMapCanvasProps['zoneShapes'],
): FeatureCollection {
  const numbers = new Map(zones.map((zone) => [zone.id, zone.number]));

  return {
    type: 'FeatureCollection',
    features: shapes.flatMap((shape) => {
      const number = numbers.get(shape.id);

      return number === undefined
        ? []
        : [{ type: 'Feature' as const, properties: { number: String(number) }, geometry: shape.geometry }];
    }),
  };
}

export function FieldMapCanvas({
  field,
  bbox,
  features,
  nearest,
  zones,
  zoneShapes,
  onFailed,
}: FieldMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onFailed });
  const [west, south, east, north] = bbox;

  useEffect(() => {
    latest.current = { onFailed };
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
      });

      map = created;
      created.on('load', () => {
        if (cancelled) return;

        const style = getComputedStyle(target);
        const token = (name: string) => style.getPropertyValue(name).trim();
        const casing = token('--map-casing');
        const highlight = token('--map-highlight');
        const selected = token('--map-selected');
        const zoneInk = token('--map-boundary-label');

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
        // miejsca na polu: przerywany obrys na jasnej obwodce (czytelny na zdjeciu) i numer jak na szkicu
        created.addSource('zones', { type: 'geojson', data: EMPTY });
        created.addLayer({
          id: 'zones-casing',
          type: 'line',
          source: 'zones',
          paint: { 'line-color': casing, 'line-width': 4, 'line-opacity': 0.9 },
        });
        created.addLayer({
          id: 'zones-line',
          type: 'line',
          source: 'zones',
          paint: { 'line-color': zoneInk, 'line-width': 2, 'line-dasharray': [2, 1.5] },
        });
        created.addLayer({
          id: 'zones-number',
          type: 'symbol',
          source: 'zones',
          layout: {
            'text-field': ['get', 'number'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 15,
            'symbol-placement': 'point',
          },
          paint: { 'text-color': zoneInk, 'text-halo-color': casing, 'text-halo-width': 2.5 },
        });
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
    void map.getSource<MapLibre.GeoJSONSource>('zones')?.setData(zoneCollection(zones, zoneShapes));
  }, [ready, features, nearest, zones, zoneShapes]);

  // tresc mapy opisuje podpis pod nia (`FieldMap`), plotno jest dla czytnika ekranu tylko ozdoba
  return <div ref={containerRef} aria-hidden="true" className="size-full" data-testid="field-map-canvas" />;
}
