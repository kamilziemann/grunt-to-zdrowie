// Port zrodla obrysow dzialek dla obszaru (warstwa "granice dzialek" na mapie). Implementacja:
// infrastructure/egib-wfs (zbiorcza usluga WFS ewidencji gruntow GUGiK); testy podaja zrodlo w pamieci.
import type { BoundingBox, PolygonGeometry } from '../parcel-geometry';

export interface ParcelOutlineRecord {
  id: string;
  number: string;
  geometry: PolygonGeometry;
}

export interface ParcelOutlines {
  items: ParcelOutlineRecord[];
  /** zrodlo oddalo swoj limit obiektow - wynik moze byc niepelny */
  truncated: boolean;
}

export interface ParcelOutlineSource {
  /** Dzialki przecinajace prostokat [zachod, poludnie, wschod, polnoc] (WGS84). */
  inBounds(bounds: BoundingBox): Promise<ParcelOutlines>;
}
