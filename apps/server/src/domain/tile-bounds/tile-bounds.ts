// Zasieg kafla XYZ (Web Mercator) w stopniach WGS84 - siatka, w ktorej mapa pobiera granice dzialek.
import type { BoundingBox } from '../parcel-geometry';

function tileLongitude(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileLatitude(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;

  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** [zachod, poludnie, wschod, polnoc] kafla; y rosnie na poludnie. */
export function tileBounds(zoom: number, x: number, y: number): BoundingBox {
  return [
    tileLongitude(x, zoom),
    tileLatitude(y + 1, zoom),
    tileLongitude(x + 1, zoom),
    tileLatitude(y, zoom),
  ];
}
