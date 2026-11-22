// Sterowanie mapa z wlasnych przyciskow ekranu (szyna przy mapie): przyblizanie i "gdzie jestem". Polozenie liczy
// ukryta kontrolka MapLibre (kropka i okrag dokladnosci na mapie, dojazd), a jej zdarzenia zamieniamy na stan
// przycisku z komunikatem slownym (szukam / znaleziono / brak zgody / niedostepne / poza Polska).
import type * as MapLibre from 'maplibre-gl';

export type LocateState = 'idle' | 'searching' | 'found' | 'denied' | 'unavailable' | 'outside';

export interface MapControls {
  zoomIn: () => void;
  zoomOut: () => void;
  locate: () => void;
}

const PERMISSION_DENIED = 1;

interface PolicyDocument {
  featurePolicy?: { allowsFeature: (feature: string) => boolean };
}

/**
 * Polozenie zablokowane naglowkiem `Permissions-Policy` strony (przegladarka zglasza to jak odmowe zgody). Wtedy
 * rolnik nic nie zmieni w ustawieniach - mowimy "niedostepne", nie "brak zgody". `featurePolicy` zna tylko Chromium.
 */
function blockedByPolicy(): boolean {
  const policy = (document as PolicyDocument).featurePolicy;

  return policy !== undefined && !policy.allowsFeature('geolocation');
}

/** Dodaje do mapy ukryta kontrolke polozenia i zwraca polecenia dla przyciskow ekranu. */
export function createMapControls(
  maplibre: typeof MapLibre,
  map: MapLibre.Map,
  onLocate: (state: LocateState) => void,
): MapControls {
  const geolocate = new maplibre.GeolocateControl({
    positionOptions: { enableHighAccuracy: true, timeout: 15_000 },
    fitBoundsOptions: { maxZoom: 16 },
  });

  map.addControl(geolocate, 'top-right');
  // przycisk kontrolki zostaje w DOM (MapLibre go potrzebuje), ale widac tylko przycisk szyny
  map.getContainer().querySelector('.maplibregl-ctrl-geolocate')?.parentElement?.setAttribute('hidden', '');
  geolocate.on('geolocate', () => onLocate('found'));
  geolocate.on('outofmaxbounds', () => onLocate('outside'));
  geolocate.on('error', (event) =>
    onLocate(event.code === PERMISSION_DENIED && !blockedByPolicy() ? 'denied' : 'unavailable'),
  );

  return {
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    locate: () => {
      // `trigger` oddaje false, gdy przegladarka nie ma geolokalizacji (np. strona bez HTTPS)
      const started = 'geolocation' in navigator && geolocate.trigger();

      onLocate(started ? 'searching' : 'unavailable');
    },
  };
}
