// Podklady map (oba darmowe, bez klucza), wspolne dla mapy dzialek i mapy w raporcie:
// - mapa: OpenFreeMap "liberty" (dane OpenStreetMap, ODbL) - drogi, miejscowosci, lasy i wody jako punkty orientacji,
// - zdjecie: ortofotomapa GUGiK przez WMS w EPSG:3857 (dane PZGiK do dowolnego wykorzystania, wymagane zrodlo).
// Bez kodu MapLibre (tylko typy) - biblioteke laduje `loadMapLibre`.
import type { RasterLayerSpecification, RasterSourceSpecification } from 'maplibre-gl';

export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const ORTHO_WMS =
  'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution' +
  '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Raster&STYLES=&FORMAT=image/jpeg' +
  '&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';

export const ORTHO_SOURCE: { id: string; spec: RasterSourceSpecification } = {
  id: 'ortho',
  spec: {
    type: 'raster',
    tiles: [ORTHO_WMS],
    tileSize: 256,
    attribution:
      'Ortofotomapa © <a href="https://www.geoportal.gov.pl" target="_blank" rel="noreferrer">GUGiK</a>',
  },
};

export const ORTHO_LAYER: RasterLayerSpecification = { id: 'ortho', type: 'raster', source: ORTHO_SOURCE.id };

/** Czcionki podpisow (nazwy ciekow, numery dzialek) - te same, ktorych uzywa styl OpenFreeMap. */
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
